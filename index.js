require('dotenv').config();

const http = require('http');

const webHookHandler = require('github-webhook-handler')({
    path: '/',
    secret: process.env.WEBHOOK_SECRET
});
const app = require('github-app')({
    id: process.env.APP_ID,
    cert: require('fs').readFileSync('.data/private-key.pem')
});

const createAccessDeniedMessage = ({ installation, repository, issue }) => {
    createIssueComment({
        message: "Access Denied! This user can't close this issue.",
        installation,
        repository,
        issue
    });
};

const createCommandNotFoundMessage = ({ installation, repository, issue }) => {
    createIssueComment({
        message: 'Sorry, this command not found.',
        installation,
        repository,
        issue
    });
};

const createIssueComment = ({ installation, repository, issue, message }) => {
    app.asInstallation(installation.id).then((github) => {
        github.issues.createComment({
            owner: repository.owner.login,
            repo: repository.name,
            number: issue.number,
            body: message
        });
    });
};

const closeIssue = ({ installation, repository, issue }) => {
    app.asInstallation(installation.id).then((github) => {
        github.issues.update({
            owner: repository.owner.login,
            repo: repository.name,
            number: issue.number,
            state: 'closed'
        });
    });
};

const botName = '@simple-issues-bot';
const userWhitelist = [13386468];
const supportedActionTypes = ['created'];

const botActions = new Map([[`${botName} close this issue`, closeIssue]]);

const handleRequest = (request, response) => {
    if (request.method !== 'POST') return response.end('ok');

    webHookHandler(request, response, () => response.end('ok'));
};

webHookHandler.on('issue_comment', (event) => {
    console.log(event);

    const { action, sender, comment } = event.payload;

    const isActionTypeSupported = supportedActionTypes.includes(action);
    const isCommentForBot = comment.body.startsWith(botName);

    if (isActionTypeSupported && !isCommentForBot) return;

    const isWhitelistUser = userWhitelist.includes(sender.id);

    if (!isWhitelistUser) {
        return createAccessDeniedMessage(event.payload);
    }

    const commandAction = botActions.get(comment.body);

    if (!commandAction) {
        return createCommandNotFoundMessage(event.payload);
    }

    commandAction(event.payload);
});

const port = process.env.PORT || 3000;

http.createServer(handleRequest).listen(port);
