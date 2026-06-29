# Blog SEO Strategy for Love On Dev

## ✅ What's Been Set Up

### Technical SEO Foundation
1. **Dynamic Blog System** (`/blog` and `/blog/[slug]`)
   - MDX support for rich content
   - Static generation for fast loading
   - Reading time calculation
   - Tag system for categorization

2. **SEO Metadata**
   - Page titles with keywords
   - Meta descriptions
   - Open Graph tags for social sharing
   - JSON-LD structured data (BlogPosting schema)

3. **Sitemap & Robots**
   - Auto-generated sitemap at `/sitemap.xml`
   - Robots.txt configured to allow blog crawling
   - Admin/portal pages excluded from search engines

4. **Performance**
   - Static site generation (SSG)
   - Tailwind Typography for readable content
   - Mobile-responsive design

## 📝 How to Write SEO-Optimized Posts

### File Structure
Create new posts in `/content/blog/your-slug.mdx`:

```mdx
---
title: "Your SEO-Friendly Title (50-60 characters)"
description: "Compelling meta description with keywords (150-160 characters)"
date: "2026-06-29"
author: "Paul Hartman"
tags: ["Tag1", "Tag2", "Tag3"]
---

Your content here...
```

### SEO Best Practices

#### 1. **Title Optimization**
- **Include target keyword** at the beginning
- **Keep it under 60 characters** (Google truncates longer titles)
- **Make it compelling** – people need to want to click

✅ Good: "Why Small Businesses Need Custom Software (Not Another SaaS)"
❌ Bad: "Some Thoughts on Software"

#### 2. **Meta Description**
- **150-160 characters** (longer gets cut off)
- **Include target keyword** naturally
- **End with a benefit or question** to encourage clicks

✅ Good: "Off-the-shelf software promises everything but delivers rigid workflows. Learn why mission-driven organizations are choosing custom solutions built for their exact needs."
❌ Bad: "This post is about software"

#### 3. **Content Structure**
- **Use H2 (##) and H3 (###) headings** with keywords
- **First 100 words are critical** – include main keyword
- **Keep paragraphs short** (2-4 sentences)
- **Use bullet points and lists**
- **Include internal links** to your services/other posts
- **Add external links** to authoritative sources

#### 4. **Keyword Strategy**
- **Primary keyword**: Main focus (e.g., "custom software for nonprofits")
- **Secondary keywords**: Related terms (e.g., "client portals", "database design")
- **Long-tail keywords**: Specific phrases (e.g., "how to build a client portal for small business")

Don't keyword stuff—aim for **1-2% keyword density**.

#### 5. **Tags**
Use 3-5 relevant tags per post:
- Your service areas (Custom Software, Database Design, Client Portals)
- Industry targets (Small Business, Nonprofits)
- Technical topics (Supabase, Next.js, PostgreSQL)

## 🎯 Content Ideas (Keyword Research)

### Service-Based Content (High Commercial Intent)
1. **"How to Build a Client Portal Your Customers Will Actually Use"**
   - Target: "client portal development"
   - CTA: Discovery call

2. **"Database Design for Growing Businesses: PostgreSQL vs. MySQL"**
   - Target: "database design services"
   - CTA: Free consultation

3. **"5 Signs Your Nonprofit Needs Custom Software"**
   - Target: "nonprofit software development"
   - CTA: Case study download

### Educational Content (High Information Intent)
4. **"Supabase vs. Firebase: Which Backend is Right for You?"**
   - Target: "supabase vs firebase"
   - Builds authority

5. **"How Much Does Custom Software Really Cost?"**
   - Target: "custom software pricing"
   - Addresses common objection

6. **"From Spreadsheets to Database: When to Make the Switch"**
   - Target: "when to use a database"
   - Practical advice

### Local/Niche Content
7. **"Tech Solutions for Small Nonprofits with Limited Budgets"**
   - Target: "nonprofit tech consultant"
   - Shows understanding of budget constraints

8. **"Case Study: Building a Member Portal for Arts Organizations"**
   - Target: "member portal development"
   - Demonstrates expertise

## 🚀 Publishing Workflow

1. **Write Draft** in `/content/blog/your-slug.mdx`
2. **Optimize**:
   - Check title length (aim for 50-60 chars)
   - Check description length (150-160 chars)
   - Verify H2/H3 structure
   - Add internal/external links
   - Include CTA at the end
3. **Test Locally**: `npm run dev` and visit `/blog/your-slug`
4. **Build**: `npm run build` to regenerate sitemap
5. **Deploy**: Push to production
6. **Submit to Google**: Submit sitemap in Google Search Console

## 📊 Measuring Success

### Key Metrics
1. **Organic Traffic** (Google Analytics)
   - Track blog visits from search
   - Monitor keyword rankings

2. **Engagement**
   - Time on page (longer = better)
   - Bounce rate (lower = better)
   - Pages per session

3. **Conversions**
   - Discovery call bookings from blog
   - Email signups (if you add a newsletter)
   - Contact form submissions

### Tools to Use
- **Google Search Console**: Track search performance
- **Google Analytics**: Monitor traffic and behavior
- **Ahrefs/SEMrush**: Keyword research and competitor analysis
- **Plausible/Fathom**: Privacy-friendly analytics alternative

## 🔗 Off-Page SEO

### Link Building
1. **Guest Posts**: Write for industry blogs (nonprofit tech, small business)
2. **Directory Listings**: Clutch, GoodFirms, freelance platforms
3. **Social Sharing**: Share posts on LinkedIn, relevant forums
4. **Email Signature**: Link to your blog
5. **Portfolio Sites**: Dribbble, Behance with links back

### Social Signals
- Share each post on LinkedIn (your primary platform)
- Engage in relevant communities (Reddit, HackerNews for technical posts)
- Consider starting a newsletter (link to blog posts)

## ⚡ Quick Wins

1. **Update Homepage Meta**: Improve your site-wide SEO
   ```tsx
   export const metadata: Metadata = {
     title: "Love On Dev | Custom Software for Small Businesses & Nonprofits",
     description: "Technical consultant specializing in client portals, database design, and practical solutions for mission-driven organizations.",
   }
   ```

2. **Add Schema Markup to Homepage**: Organization schema
3. **Optimize Images**: Add alt text, compress files
4. **Fix Core Web Vitals**: Use Next.js Image component everywhere
5. **Enable Analytics**: Add Google Analytics or Plausible

## 📅 Recommended Publishing Schedule

**Start with 2 posts per month**:
- Week 1: Service-focused post (commercial intent)
- Week 3: Educational post (information intent)

**Why this works**:
- Manageable commitment
- Builds consistent content library
- Alternates between sales and education
- Google rewards consistent publishing

## 🎯 First 3 Posts to Write

1. **"Why Small Businesses Need Custom Software"** (Already created! ✅)
2. **"How to Choose the Right Database for Your Business"** (Technical + service)
3. **"5 Real Benefits of Building a Client Portal"** (Service + case study)

## Next Steps

1. **Set up Google Search Console** and submit your sitemap
2. **Install analytics** (Google Analytics or Plausible)
3. **Write 2-3 more posts** using the keyword ideas above
4. **Share on LinkedIn** with targeted hashtags
5. **Monitor and iterate** based on what performs well

---

**Pro Tip**: The best SEO is writing genuinely helpful content for your target audience. Focus on solving real problems your ideal clients are searching for, and the rankings will follow.
