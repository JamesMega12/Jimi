import re

with open('src/components/FcoTablesEditor.tsx', 'r') as f:
    content = f.read()
content = content.replace('updateRow(tableName, i, c.field, e.target.value)', 'updateRow(tableName, i, String(c.field), e.target.value)')
with open('src/components/FcoTablesEditor.tsx', 'w') as f:
    f.write(content)

with open('src/components/TechComReviewNotes.tsx', 'r') as f:
    content = f.read()
content = content.replace('`${categoryKey}-${idx}`', '`${String(categoryKey)}-${idx}`')
content = content.replace('toggleResolved(categoryKey, idx)', 'toggleResolved(String(categoryKey), idx)')
content = content.replace('(list?.length || 0)', '((list as any[])?.length || 0)')
with open('src/components/TechComReviewNotes.tsx', 'w') as f:
    f.write(content)

