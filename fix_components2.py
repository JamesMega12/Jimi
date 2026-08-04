with open('src/components/TechComReviewNotes.tsx', 'r') as f:
    content = f.read()

content = content.replace('((list as any[])?.length || 0), 0);', '(Number((list as any[])?.length) || 0), 0 as number);')

with open('src/components/TechComReviewNotes.tsx', 'w') as f:
    f.write(content)
