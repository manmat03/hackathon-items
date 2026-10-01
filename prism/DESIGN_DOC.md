# Design

expected folders:
- frontend
- backend

## General design notes

This is running LOCALLY. Do not worry about user accounts, nor session persistance. 

## Frontend design

### Technical Choices
- Use SolidJS (not SolidStart) for the frontend
- Use TypeScript, not vanilla JS

### UI Notes

For now, just have a simple UI where a user can enter a paragraph and have that be submitted

### Technical Details

When a user submits their paragraph, POST it to this endpoint: `/plaintext`
