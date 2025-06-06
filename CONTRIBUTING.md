# Contributing to K6 Executor Cluster

Thank you for your interest in contributing to K6 Executor Cluster! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone git@github.com:YOUR_USERNAME/aws-loadtest-environment.git`
3. Install dependencies: `yarn install`
4. Create a feature branch: `git checkout -b feature/amazing-feature`

## Development Workflow

1. Make your changes
2. Run tests: `yarn test`
3. Lint your code: `yarn lint`
4. Build the project: `yarn build`
5. Commit your changes: `git commit -m 'Add some amazing feature'`
6. Push to your branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the documentation if needed
3. The PR should work with the existing tests
4. Ensure all CI checks pass
5. Request review from maintainers

## Release Process

Releases are managed by the maintainers using the GitHub Actions workflow. To create a new release:

1. Ensure all changes are merged to the main branch
2. Go to the "Actions" tab in the GitHub repository
3. Select the "Release" workflow
4. Click "Run workflow"
5. Enter the new version number (e.g., "1.0.0")
6. Click "Run workflow"

This will:

- Create a new version tag
- Update the package.json version
- Create a GitHub release
- Trigger the publish workflow to publish to npm

## Coding Standards

- Follow TypeScript best practices
- Write tests for new features
- Document public APIs
- Keep code modular and maintainable
- Follow the existing code style

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [Apache License 2.0](LICENSE.md).
