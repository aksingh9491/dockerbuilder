import express from 'express'
import bodyParser from 'body-parser'

const PORT = process.env.PORT || 8080
const app = express()
app.use(bodyParser.json())

app.post('/build', async (req, res) => {
    console.log(req.body)

    //Do stuff with body
    res.status(200).end()
})

app.get('*', async (req, res) => {
    res.status(200).send('pong')
})

app.listen(PORT, () => console.log(`Server listening port ${PORT}`))