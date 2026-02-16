# Documentation Writing Skill

## Description
Comprehensive documentation creation for technical projects, APIs, and user guides.

## Capabilities
- API documentation with clear examples
- User-friendly guides and tutorials  
- Technical architecture documentation
- Code comments and inline documentation
- README files and project overviews

## Documentation Standards
- **Clarity**: Write for the intended audience
- **Completeness**: Cover all necessary information
- **Examples**: Include practical, working examples
- **Structure**: Use consistent formatting and hierarchy
- **Maintenance**: Keep docs updated with code changes

## Templates
### API Endpoint Documentation
```
## POST /api/resource
Creates a new resource.

**Parameters:**
- `name` (string, required): Resource name
- `type` (string, optional): Resource type

**Response:**
```json
{
  "id": "123",
  "name": "Example Resource",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**Example:**
```bash
curl -X POST /api/resource \
  -H "Content-Type: application/json" \
  -d '{"name": "My Resource"}'
```
```