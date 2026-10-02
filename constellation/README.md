# Constellation

A smart, graph-based, project tracker.

## setup instructions
### backend
- `cd backend`
- `uv sync`
Move `.sample.env` to `.env` and add your API info.

### frontend
- `cd frontend`
- `npm install`

## run instructions:
### backend
- `cd backend`
- `uv fastapi dev .\main.py --host localhost`
Make sure to open your browser for EntraID verification.

### frontend
- `cd frontend`
- `npm run dev`
