#!/bin/sh

set -e

if [ -z "${VCS_HOST}" ]; then
  echo "VCS_HOST is not set. Exiting."
  exit 1
fi

if [ -z "${REPO_URL}" ]; then
  echo "REPO_URL is not set. Exiting."
  exit 1
fi

if [ -z "${ACCESS_TOKEN}" ]; then
  echo "ACCESS_TOKEN is not set. Exiting."
  exit 1
fi

echo "Preparing to clone repository"

git config --global url."https://oauth2:${ACCESS_TOKEN}@${VCS_HOST}/".insteadOf https://${VCS_HOST}/

echo "Cloning repository ${REPO_URL} to ${TARGET_DIR}"

git clone ${REPO_URL} ${TARGET_DIR}

echo "Load-Test sources downloaded"