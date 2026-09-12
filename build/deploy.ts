import Client from 'ssh2-sftp-client';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required environment variable: ${name}`);

    return value;
}

const upload = {
    host: requireEnv('SFTP_HOST'),
    port: Number.parseInt(process.env.SFTP_PORT ?? '22', 10),
    username: requireEnv('SFTP_USER'),
    password: requireEnv('SFTP_PASSWORD'),
    fromLocalPath: 'dist',
    toRemotePath: requireEnv('SFTP_TARGET')
};

if (!Number.isInteger(upload.port) || upload.port < 1 || upload.port > 65535)
    throw new Error('SFTP_PORT must be a valid TCP port');

console.log('START Deployment');

const client = new Client();
try {
    await client.connect({
        host: upload.host,
        port: upload.port,
        username: upload.username,
        password: upload.password
    });
    client.on('upload', info => {
        console.log(`Listener: Uploaded ${info.source}`);
    });

    await client.uploadDir(upload.fromLocalPath, upload.toRemotePath, {
        useFastput: true
    });
    console.log('UPLOAD finished');
}
catch (e) {
    console.error('Upload failed', e);
    process.exitCode = 1;
}
finally {
    await client.end();
}