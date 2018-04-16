/**
 * Dockerbuilder replaces docker hub build feature for toska
 * Places to improve (TODO):
 *  - handle case when no 'staging' exists and we wish to release latest
 *  - clear old untagged images to save space
 *  - refactor existing code
 *  - log smarter
 */
import express from 'express'
import bodyParser from 'body-parser'
import git from 'simple-git'
import { spawn } from 'child_process'
import path from 'path'

const PORT = process.env.PORT || 8080
const simpleGit = git()
const app = express()
app.use(bodyParser.json())

/**
 * Builds a new image from a repository, 
 * always builds master branch and tags it staging.
 * 
 * Then pushes the built image to registry
 * 
 * @param {*} name name of the repository
 * @param {*} clone_url url from which to git clone
 */
const buildImage = async (name, clone_url) => {
    try {
        const imageName = `localhost:5000/${name}:staging`
        const here = path.resolve(__dirname)
        const repositoryLocation = `${here}/repository/${name}/${(new Date()).valueOf()}`

        const simpleGit = await git().clone(clone_url, repositoryLocation)
        const process = spawn('docker', ['build', '.', '-t', imageName], { cwd: repositoryLocation })
        process.stdout.on('data', (data) => {
            if (data) {
                console.log(`Process ${name}: ` + data);
            }
        });
        process.on("close", (code, signal) => {
            spawn('rm', ['-r', repositoryLocation])
            spawn('docker', ['push', imageName])
        })
    } catch (e) {
        console.log('Building image failed:', e)
    }
}

/**
 * Tags the most recent image with tag staging as latest
 * 
 * @param {*} name name of the repository
 */
const tagRelease = async (name) => {
    try {
        const imageName = `localhost:5000/${name}`
        const newTag = spawn('docker', ['tag', `${imageName}:staging`, imageName])
        newTag.on("close", (code, signal) => {
            spawn('docker', ['push', imageName])
        })
    } catch (e) {
        console.log('Releasing tag failed:', e)
    }
}

/**
 * Handles the input payload for staging build / release
 * 
 * @param {*} req Request object
 * @param {*} res Response object
 */
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
        return res.status(200).end()
    }
    if (!ref.includes('master')) {
        if (ref.includes('tags')) { // This is for our current setup, tags are only made on master branch.
            tagRelease(name)
        }
        return res.status(200).end()
    }
    buildImage(name, clone_url)
    res.status(200).end()
}

app.post('/build', handlePush)

app.listen(PORT, () => console.log(`Server listening port ${PORT}`))