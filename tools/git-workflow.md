# Git Workflow Tool

## Description
Standardized Git workflow commands and best practices for consistent version control.

## Common Commands

### Branch Management
```bash
# Create and switch to feature branch
git checkout -b feature/new-feature

# Switch to main branch
git checkout main

# Delete merged branch
git branch -d feature/old-feature
```

### Commit Workflow
```bash
# Stage changes
git add .

# Commit with conventional commit format
git commit -m "feat: add new feature (#123)"

# Push to remote
git push origin feature/new-feature
```

### Code Review Process
```bash
# Create pull request (after push)
gh pr create --title "Add new feature" --body "Description of changes"

# View PR status
gh pr status

# Merge PR
gh pr merge --squash
```

### Maintenance
```bash
# Update main branch
git checkout main
git pull origin main

# Clean up merged branches
git branch --merged | grep -v main | xargs -n 1 git branch -d
```

## Conventional Commits
- `feat:` - New features
- `fix:` - Bug fixes  
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test additions/modifications
- `chore:` - Maintenance tasks