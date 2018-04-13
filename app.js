import express from 'express'
import bodyParser from 'body-parser'
import git from 'simple-git'
import { spawn } from 'child_process'
import path from 'path'

const PORT = process.env.PORT || 8080
const simpleGit = git()
const app = express()
app.use(bodyParser.json())


const buildaa = async (req, res) => {
    const push = req.body
    const { clone_url } = push.repository
    const { name } = push.repository
    const here = path.resolve(__dirname)
    const repositoryLocation = `${here}/repository/${name}`

    const simpleGit = await git().clone(clone_url, repositoryLocation)
    const process = spawn('docker', ['build', '.', '-t', `localhost:5000/${name}`], { cwd: repositoryLocation })
    process.stdout.on('data', (data) => {
        console.log(`Process ${name}: ` + data);
    });
    process.on("close", (code, signal) => {
        spawn('rm', ['-r', repositoryLocation])
        spawn('docker', ['push', `localhost:5000/${name}`])
    })

    res.status(200).end()
}

app.post('/build', buildaa)

// app.get('*', buildaa)

app.listen(PORT, () => console.log(`Server listening port ${PORT}`))