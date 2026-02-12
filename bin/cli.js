#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { spawn } = require('child_process');

program
  .name('openclaw-hub')
  .description('OpenClaw AI Communication Hub')
  .version('1.0.0');

program
  .command('start')
  .description('Start the OpenClaw Hub broker')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .action((options) => {
    const port = options.port || 3000;
    console.log(chalk.green(`🚀 Starting OpenClaw Hub on port ${port}...`));
    console.log(chalk.dim('Press Ctrl+C to stop\n'));

    const broker = spawn('node', ['broker.js'], {
      stdio: 'inherit',
      env: { ...process.env, PORT: port }
    });

    broker.on('exit', (code) => {
      if (code !== 0) {
        console.log(chalk.yellow(`\nBroker exited with code ${code}`));
      }
    });
  });

program
  .command('stop')
  .description('Stop the OpenClaw Hub broker')
  .action(() => {
    const { spawn } = require('child_process');
    spawn('pkill', ['-f', 'broker.js'], { stdio: 'inherit' });
    console.log(chalk.green('✓ OpenClaw Hub stopped'));
  });

program
  .command('restart')
  .description('Restart the OpenClaw Hub broker')
  .action(() => {
    const { spawn } = require('child_process');
    console.log(chalk.yellow('🔄 Restarting OpenClaw Hub...'));

    spawn('pkill', ['-f', 'broker.js'], { stdio: 'inherit' }).on('exit', () => {
      setTimeout(() => {
        const broker = spawn('node', ['broker.js'], { stdio: 'inherit' });
        console.log(chalk.green('✓ OpenClaw Hub restarted'));
      }, 1000);
    });
  });

program
  .command('status')
  .description('Check if the OpenClaw Hub is running')
  .action(() => {
    const { execSync } = require('child_process');
    try {
      const pid = execSync('pgrep -f broker.js').toString().trim();
      console.log(chalk.green('✓ OpenClaw Hub is running'));
      console.log(chalk.dim(`PID: ${pid}`));
    } catch (error) {
      console.log(chalk.yellow('✗ OpenClaw Hub is not running'));
    }
  });

program.parse();
