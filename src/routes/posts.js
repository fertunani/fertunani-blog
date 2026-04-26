const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const db = require('../db/database')
const slugify = require('slugify')
const { marked } = require('marked')
const { requireAuth } = require('../middleware/auth')

marked.setOptions({ breaks: true })

function ensurePostDir(slug) {
  const dir = path.join(__dirname, '../../posts-data', slug, 'images')
  fs.mkdirSync(dir, { recursive: true })
}

// Formulário de criação — deve vir ANTES de /:slug
router.get('/admin/new', requireAuth, async (req, res) => {
  let draft = null
  if (req.query.draft) {
    const [rows] = await db.execute(`SELECT * FROM drafts WHERE id = ?`, [req.query.draft])
    if (rows.length) draft = rows[0]
  }
  res.render('admin/new', { error: null, draft })
})

router.post('/admin/new', requireAuth, async (req, res) => {
  const { title, content } = req.body
  if (!title || !content) return res.render('admin/new', { error: 'Preencha todos os campos' })

  const slug = slugify(title, { lower: true, strict: true })

  try {
    await db.execute(
      `INSERT INTO posts (title, slug, content) VALUES (?, ?, ?)`,
      [title, slug, content]
    )
    ensurePostDir(slug)
    res.redirect(`/posts/${slug}`)
  } catch (err) {
    res.render('admin/new', { error: 'Slug já existe ou erro no banco: ' + err.message })
  }
})

// Formulário de edição
router.get('/admin/edit/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT * FROM posts WHERE id = ?`, [req.params.id])
    if (!rows.length) return res.status(404).render('404')
    res.render('admin/edit', { post: rows[0], error: null })
  } catch {
    res.status(500).send('Erro no banco de dados')
  }
})

router.post('/admin/edit/:id', requireAuth, async (req, res) => {
  const { title, content, published } = req.body
  const slug = slugify(title, { lower: true, strict: true })

  try {
    await db.execute(
      `UPDATE posts SET title = ?, slug = ?, content = ?, published = ? WHERE id = ?`,
      [title, slug, content, published ? 1 : 0, req.params.id]
    )
    ensurePostDir(slug)
    res.redirect(`/posts/${slug}`)
  } catch (err) {
    const [rows] = await db.execute(`SELECT * FROM posts WHERE id = ?`, [req.params.id])
    res.render('admin/edit', { error: 'Erro ao atualizar: ' + err.message, post: rows[0] || req.body })
  }
})

// Deletar post
router.post('/admin/delete/:id', requireAuth, async (req, res) => {
  try {
    await db.execute(`DELETE FROM posts WHERE id = ?`, [req.params.id])
  } catch {}
  res.redirect('/')
})

// Post individual — deve vir POR ÚLTIMO
router.get('/:slug', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM posts WHERE slug = ? AND published = 1`,
      [req.params.slug]
    )
    if (!rows.length) return res.status(404).render('404')
    const post = rows[0]
    post.html = marked(post.content)
    res.render('post', { post })
  } catch (err) {
    res.status(500).send('Erro no banco de dados')
  }
})

module.exports = router
