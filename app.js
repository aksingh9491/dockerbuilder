import express from 'express'
import bodyParser from 'body-parser'
import git from 'simple-git'
import { spawn } from 'child_process'
import path from 'path'

const PORT = process.env.PORT || 8080
const simpleGit = git()
const app = express()
app.use(bodyParser.json())

const buildImage = async (name, clone_url) => {
    try {
        const containerName = `localhost:5000/${name}:staging`
        const here = path.resolve(__dirname)
        const repositoryLocation = `${here}/repository/${name}`

        const simpleGit = await git().clone(clone_url, repositoryLocation)
        const process = spawn('docker', ['build', '.', '-t', containerName], { cwd: repositoryLocation })
        process.stdout.on('data', (data) => {
            if (data) {
                console.log(`Process ${name}: ` + data);
            }
        });
        process.on("close", (code, signal) => {
            spawn('rm', ['-r', repositoryLocation])
            spawn('docker', ['push', containerName])
        })
    } catch (e) {
        console.log('Building image failed:', e)
    }
}

const tagRelease = async (name) => {
    try {
        const containerName = `localhost:5000/${name}`
        const newTag = spawn('docker', ['tag', `${containerName}:staging`, containerName])
        newTag.on("close", (code, signal) => {
            spawn('docker', ['push', containerName])
        })
    } catch (e) {
        console.log('Releasing tag failed:', e)
    }
}

const handlePush = async (req, res) => {
    const push = req.body
    const { ref } = push
    const { clone_url, name } = push.repository
    if (!ref || !clone_url || !name) {
        console.log(
            '----------------------------------------------',
            push,
            '----------------------------------------------',
            `Ref: ${ref}, clone_url: ${clone_url}, name: ${name}`
        )
    }
    if (!ref.includes('master')) {
        if (!ref.includes('tags')) { // This is for our current setup, tags are only made on master branch.
            tagRelease(name)
        }
        return res.status(200).end()
    }
    buildImage(name, clone_url)
    res.status(200).end()
}

app.post('/build', handlePush)

app.listen(PORT, () => console.log(`Server listening port ${PORT}`))