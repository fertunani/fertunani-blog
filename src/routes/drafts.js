const express = require('express')
const router = express.Router()
const db = require('../db/database')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

// Lista rascunhos
router.get('/', async (req, res) => {
  const [drafts] = await db.execute(`SELECT * FROM drafts ORDER BY updated_at DESC`)
  res.render('admin/drafts', { drafts })
})

// Cria rascunho vazio e retorna id
router.post('/', async (req, res) => {
  const [result] = await db.execute(
    `INSERT INTO drafts (title, content) VALUES (?, ?)`,
    ['', '']
  )
  res.json({ id: result.insertId })
})

// Salva rascunho (autosave) — grava histórico antes de sobrescrever
router.put('/:id', async (req, res) => {
  const { title, content } = req.body
  const { id } = req.params

  const [rows] = await db.execute(`SELECT * FROM drafts WHERE id = ?`, [id])
  if (!rows.length) return res.status(404).json({ error: 'Rascunho não encontrado' })

  const current = rows[0]

  // Só grava histórico se o conteúdo mudou
  if (current.title !== title || current.content !== content) {
    await db.execute(
      `INSERT INTO draft_history (draft_id, title, content) VALUES (?, ?, ?)`,
      [id, current.title, current.content]
    )

    // Mantém apenas as últimas 20 versões
    const [hist] = await db.execute(
      `SELECT id FROM draft_history WHERE draft_id = ? ORDER BY saved_at DESC`,
      [id]
    )
    if (hist.length > 20) {
      const toDelete = hist.slice(20).map(h => h.id)
      for (const hid of toDelete) {
        await db.execute(`DELETE FROM draft_history WHERE id = ?`, [hid])
      }
    }
  }

  await db.execute(
    `UPDATE drafts SET title = ?, content = ?, updated_at = (datetime('now')) WHERE id = ?`,
    [title, content, id]
  )

  res.json({ ok: true })
})

// Histórico de versões de um rascunho
router.get('/:id/history', async (req, res) => {
  const [rows] = await db.execute(
    `SELECT id, title, saved_at FROM draft_history WHERE draft_id = ? ORDER BY saved_at DESC`,
    [req.params.id]
  )
  res.json(rows)
})

// Conteúdo de uma versão específica
router.get('/:id/history/:hid', async (req, res) => {
  const [rows] = await db.execute(
    `SELECT * FROM draft_history WHERE id = ? AND draft_id = ?`,
    [req.params.hid, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Versão não encontrada' })
  res.json(rows[0])
})

// Deleta rascunho
router.delete('/:id', async (req, res) => {
  await db.execute(`DELETE FROM drafts WHERE id = ?`, [req.params.id])
  res.json({ ok: true })
})

module.exports = router
