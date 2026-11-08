/**
 * GitHub Push Script for SanjitRS/KKRTC
 * 
 * Usage:
 *   node scripts/push_to_github.js <YOUR_GITHUB_TOKEN>
 * or:
 *   $env:GITHUB_TOKEN="ghp_..."; node scripts/push_to_github.js
 */

const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');
const path = require('path');

async function push() {
  const token = process.argv[2] || process.env.GITHUB_TOKEN;

  if (!token) {
    console.error('Error: GitHub Personal Access Token (PAT) is required.');
    console.log('\nUsage:');
    console.log('  node scripts/push_to_github.js <YOUR_GITHUB_PAT>');
    console.log('or set $env:GITHUB_TOKEN and run:');
    console.log('  node scripts/push_to_github.js\n');
    console.log('To generate a token:');
    console.log('  1. Go to https://github.com/settings/tokens');
    console.log('  2. Generate new token (classic) with "repo" scope');
    console.log('  3. Provide the token to push to https://github.com/SanjitRS/KKRTC');
    process.exit(1);
  }

  const dir = path.resolve(__dirname, '..');
  const remoteUrl = 'https://github.com/SanjitRS/KKRTC.git';

  console.log('🚀 Preparing to push to', remoteUrl);
  console.log('👤 Committer: SanjitRS');

  // Verify remote is set
  await git.addRemote({
    fs,
    dir,
    remote: 'origin',
    url: remoteUrl,
    force: true
  });

  console.log('📦 Pushing main branch to origin...');

  const pushResult = await git.push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref: 'main',
    force: true,
    onAuth: () => ({
      username: 'SanjitRS',
      password: token.trim()
    })
  });

  if (pushResult.ok) {
    console.log('✅ Successfully pushed to https://github.com/SanjitRS/KKRTC !');
  } else {
    console.error('❌ Push failed:', pushResult);
  }
}

push().catch(err => {
  console.error('❌ Error during push:', err.message);
  if (err.data && err.data.response) {
    console.error('Server response:', err.data.response);
  }
  process.exit(1);
});
