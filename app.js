/**
 * Dockerbuilder replaces docker hub build feature for toska
 * Places to improve (TODO):
 *  - handle case when no 'staging' exists and we wish to release latest
 *  - clear old untagged images to save space
 *  - refactor existing code
 */
import express from 'express'
import bodyParser from 'body-parser'
import git from 'simple-git'
import { spawn } from 'child_process'
import path from 'path'
import winston from 'winston'
import 'winston-log2gelf'

const PORT = process.env.PORT || 8080
const simpleGit = git()
const app = express()
app.use(bodyParser.json())

const logger = new winston.Logger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.Log2gelf({
            hostname: 'dockerbuilder',
            host: process.env.LOG_HOST || 'localhost',
            port: process.env.LOG_PORT || '1234',
            protocol: 'http'
        })
    ]
})

// Just to cut the number of http requests sent.
const ongoingLogs = {}

const calmerLog = (data, name) => {
    if (!data || !/\S/.test(data)) return // Has to contain a symbol other than whitespace
    !ongoingLogs[name] ?
        ongoingLogs[name] = [data] :
        ongoingLogs[name].push(data)

    if (ongoingLogs[name].length > 4) {
        logger.info(ongoingLogs[name].join('\n'))
        ongoingLogs[name] = []
    }
}
const clearOngoing = (name) => {
    logger.info(ongoingLogs[name].join('\n'))
    delete ongoingLogs[name]
}

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
            calmerLog(data, repositoryLocation)
        });
        process.on("close", (code, signal) => {
            clearOngoing(repositoryLocation)
            spawn('rm', ['-r', repositoryLocation])
            spawn('docker', ['push', imageName])
            logger.log(`New image created: ${}`)
        })
    } catch (e) {
        logger.error('Building image failed:', e)
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
            logger.info(`Released: ${imageName}`)
        })
    } catch (e) {
        logger.error('Releasing tag failed:', e)
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
        logger.warn(
            '----------------------------------------------',
            push,
            '----------------------------------------------',
            `Ref: ${ref}, clone_url: ${clone_url}, name: ${name}`
        )
        return res.status(200).end()
    }
    if (!ref.includes('master')) {
        if (ref.includes('tags')) { // This is for our current setup, tags are only made on master branch.
            logger.info(`New release started ${name}`)
            tagRelease(name)
        }
        return res.status(200).end()
    }
    logger.info(`New staging release build started ${name}`)
    buildImage(name, clone_url)
    res.status(200).end()
}

app.post('/build', handlePush)

app.listen(PORT, () => {
    logger.info(`Started dockerbuilder on port ${PORT}`)
})