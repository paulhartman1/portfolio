# Blog Content Directory

This directory contains all blog posts for loveondev.com.

## Creating a New Post

1. Create a new `.mdx` file in this directory
2. Use kebab-case for the filename (becomes the URL slug)
3. Include frontmatter with required fields

### Example Post Template

```mdx
---
title: "Your Post Title Here (50-60 characters for SEO)"
description: "Meta description that appears in search results (150-160 characters)"
date: "2026-06-29"
author: "Paul Hartman"
tags: ["Custom Software", "Small Business", "Supabase"]
---

Your content starts here...

## Use H2 for main sections

### Use H3 for subsections

Write in markdown with all standard formatting:
- Bullet points
- **Bold text**
- *Italic text*
- [Links](https://example.com)
- `inline code`

```code blocks```

> Blockquotes for callouts

## End with a CTA

[Book a discovery call](https://tidycal.com/loveondev)
```

## File Naming

- Use lowercase
- Use hyphens (not underscores or spaces)
- Be descriptive but concise
- Example: `building-client-portals-for-nonprofits.mdx`

## Testing Locally

```bash
npm run dev
```

Then visit `http://localhost:3000/blog/your-slug`

## Deploying

After creating a new post:

```bash
npm run build
git add .
git commit -m "Add blog post: Your Title"
git push
```

The site will automatically deploy with the new post.

## SEO Checklist

- [ ] Title is 50-60 characters
- [ ] Description is 150-160 characters  
- [ ] Date is in YYYY-MM-DD format
- [ ] 3-5 relevant tags included
- [ ] Primary keyword in first paragraph
- [ ] H2/H3 headings used for structure
- [ ] Internal links to services/other posts
- [ ] CTA at the end
- [ ] Proofread for typos

## Need Help?

See the full SEO guide in `/BLOG_SEO_GUIDE.md`
