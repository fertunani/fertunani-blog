require('dotenv').config()
const express = require('express')
const session = require('express-session')
const path = require('path')
const { requireAuth } = require('./src/middleware/auth')

const app = express()
const port = process.env.PORT || 3000

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'src/views'))

app.use(session({
  secret: process.env.SESSION_SECRET || 'fertunani-secret-dev',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}))

// Layout wrapper global
app.use((req, res, next) => {
  const originalRender = res.render.bind(res)
  res.render = (view, data = {}) => {
    originalRender(view, { ...data, isAdmin: !!(req.session && req.session.authenticated) }, (err, body) => {
      if (err) return next(err)
      originalRender('layout', { ...data, body, title: data.title, isAdmin: !!(req.session && req.session.authenticated) }, (err2, html) => {
        if (err2) return next(err2)
        res.send(html)
      })
    })
  }
  next()
})

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))
app.use('/posts-data', express.static(path.join(__dirname, 'posts-data')))

// Login / logout
app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/')
  res.render('login', { title: 'Entrar', error: null })
})

app.post('/login', (req, res) => {
  const { password } = req.body
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true
    return res.redirect('/')
  }
  res.render('login', { title: 'Entrar', error: 'Senha incorreta' })
})

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'))
})

app.use('/', require('./src/routes/index'))
app.use('/upload', requireAuth, require('./src/routes/upload'))
app.use('/posts', require('./src/routes/posts'))
app.use('/drafts', require('./src/routes/drafts'))

app.use((req, res) => {
  res.status(404).render('404', { title: 'Não encontrado' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Blog rodando em http://localhost:${port}`)
})
