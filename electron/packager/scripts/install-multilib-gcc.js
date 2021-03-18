// @ts-check
const isCI = require('is-ci');
if (isCI && process.platform === 'linux') {
    const shell = require('shelljs');
    shell.exec('sudo apt-get install --no-install-recommends -y gcc-multilib g++-multilib', { async: false });
    const error = shell.error();
    if (error) {
        shell.echo(error);
        shell.exit(1);
    }
    shell.exit(0);
}
