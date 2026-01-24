#!/usr/bin/env node
/**
 * GitHub Pinned Repositories 해제 스크립트
 * 모든 고정된 레포지토리를 해제합니다.
 */

require('dotenv').config();
const axios = require('axios');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN 환경 변수가 설정되지 않았습니다.');
  console.error('1. GitHub Personal Access Token을 생성하세요 (Settings > Developer settings > Personal access tokens)');
  console.error('2. 토큰에 "user" scope를 부여하세요');
  console.error('3. .env 파일에 GITHUB_TOKEN=your_token 을 추가하세요');
  process.exit(1);
}

const graphqlClient = axios.create({
  baseURL: GITHUB_GRAPHQL_URL,
  headers: {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function getCurrentUser() {
  const query = `
    query {
      viewer {
        login
        id
      }
    }
  `;

  const response = await graphqlClient.post('', { query });
  return response.data.data.viewer;
}

async function getPinnedRepos(userId) {
  const query = `
    query($userId: ID!) {
      node(id: $userId) {
        ... on User {
          pinnedItems(first: 6, types: REPOSITORY) {
            nodes {
              ... on Repository {
                id
                name
                owner {
                  login
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await graphqlClient.post('', {
    query,
    variables: { userId }
  });

  return response.data.data.node.pinnedItems.nodes;
}

async function unpinRepo(itemId) {
  const mutation = `
    mutation($itemId: ID!) {
      unpinItem(input: { itemId: $itemId }) {
        clientMutationId
      }
    }
  `;

  await graphqlClient.post('', {
    query: mutation,
    variables: { itemId }
  });
}

async function main() {
  try {
    console.log('GitHub 인증 확인 중...');
    const user = await getCurrentUser();
    console.log(`인증됨: ${user.login}`);

    console.log('\n고정된 레포지토리 조회 중...');
    const pinnedRepos = await getPinnedRepos(user.id);

    if (pinnedRepos.length === 0) {
      console.log('고정된 레포지토리가 없습니다.');
      return;
    }

    console.log(`${pinnedRepos.length}개의 고정된 레포지토리를 찾았습니다:\n`);
    pinnedRepos.forEach((repo, i) => {
      console.log(`  ${i + 1}. ${repo.owner.login}/${repo.name}`);
    });

    console.log('\n고정 해제 중...');
    for (const repo of pinnedRepos) {
      await unpinRepo(repo.id);
      console.log(`  ✓ ${repo.owner.login}/${repo.name} 고정 해제됨`);
    }

    console.log('\n모든 레포지토리의 고정이 해제되었습니다!');
  } catch (error) {
    if (error.response) {
      console.error('API 오류:', error.response.data);
    } else {
      console.error('오류:', error.message);
    }
    process.exit(1);
  }
}

main();
