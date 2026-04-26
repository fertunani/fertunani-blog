const express = require('express')
const router = express.Router()
const db = require('../db/database')

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, title, slug, created_at FROM posts WHERE published = 1 ORDER BY created_at DESC`
    )

    const grouped = {}
    rows.forEach(post => {
      const date = new Date(post.created_at + 'Z')
      const year = date.toLocaleString('pt-BR', { year: 'numeric', timeZone: 'America/Sao_Paulo' })
      const month = date.toLocaleString('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' })

      if (!grouped[year]) grouped[year] = {}
      if (!grouped[year][month]) grouped[year][month] = []
      grouped[year][month].push(post)
    })

    res.render('index', { grouped })
  } catch (err) {
    console.error(err)
    res.status(500).send('Erro no banco de dados')
  }
})

module.exports = router
