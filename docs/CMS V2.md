Blog CMS V2 UI / UX + 信息架构优化需求

目标：把当前 Blog CMS 从“开发测试后台”升级为一个真正可长期使用的个人内容管理系统。

不修改现有数据库核心设计，不破坏现有 API 和前台网站。优先复用现有代码、D1 schema、API 和 Markdown renderer。

一、首先解决整体信息架构

当前：

Dashboard
Posts
New Post

这是不合理的。

因为现在网站实际上至少有两类内容：

Blog
随记 / Notes

必须在 CMS 层面明确分离。

新的 Sidebar

设计成：

┌──────────────────────┐
│  FRANK CMS           │
│                      │
│  Overview             │
│                      │
│  CONTENT              │
│  ├─ Blog              │
│  ├─ Notes             │
│  └─ Drafts            │
│                      │
│  ORGANIZE              │
│  ├─ Categories        │
│  ├─ Tags              │
│  └─ Media              │
│                      │
│  SYSTEM                │
│  ├─ Activity           │
│  └─ Settings           │
│                      │
│  ─────────────────    │
│  View Website ↗       │
│  Logout                │
└──────────────────────┘
注意

不要再使用：

Posts

作为主要内容入口。

应该改成：

Blog
Notes
二、Blog 和 Notes 必须真正分开

数据库已经存在：

posts.collection

所以不要新增两套 Posts 表。

继续使用：

posts

通过：

collection = 'blog'
collection = 'notes'

区分。

URL

后台：

/admin/blog
/admin/blog/new
/admin/blog/:id/edit

/admin/notes
/admin/notes/new
/admin/notes/:id/edit

而不是：

/admin/posts
/admin/posts/new
三、Blog 列表页面

设计成真正的文章管理界面。

Blog
────────────────────────────────────────────

Blog posts                         + New Article

[ Search articles... ] [Category] [Status] [Locale]

────────────────────────────────────────────

Title                 Status     Category    Updated
────────────────────────────────────────────
日本語を勉強して一年      Published  学习       2h ago
My life in Tokyo       Draft      Life       Yesterday
Why I started...       Published  Thoughts   Aug 28

────────────────────────────────────────────

Showing 1–20 of 43                    < 1 2 3 >

每一行支持：

Edit
Preview
Publish / Unpublish
Delete

不要把大量字段直接塞进表格。

四、Notes 页面

Notes 和 Blog 使用相同的 Editor，但是独立管理。

Notes

短小、随手记录、生活感悟、学习记录等。

                         + New Note

[ Search notes... ] [Status] [Locale]

────────────────────────────────────

标题                  状态        更新时间
JLPT考试后的想法       Published   Today
今天在高田马場学习      Draft       Yesterday
东京下雨了             Published   Aug 30
五、Blog / Notes Dashboard 统计必须分开

现在截图中的：

ARTICLES
PUBLISHED
DRAFTS
CATEGORIES
TAGS

全是 —，而且信息价值比较低。

改成：

CONTENT

┌────────────────┐
│ BLOG           │
│                │
│ 28             │
│ Articles       │
│                │
│ 21 Published   │
│ 7 Drafts       │
└────────────────┘

┌────────────────┐
│ NOTES          │
│                │
│ 46             │
│ Notes          │
│                │
│ 39 Published   │
│ 7 Drafts       │
└────────────────┘

┌────────────────┐
│ MEDIA          │
│                │
│ 128            │
│ Images         │
└────────────────┘

下面增加：

Recent Activity

例如：

10 min ago
Published "日本語を勉強して一年"

2 hours ago
Updated "My experience in Tokyo"

Yesterday
Uploaded 3 images
六、整体 UI 必须重新设计

当前截图最大的问题之一是：

文字、背景、边框、间距全部挤在同一个视觉层级。

尤其：

WELCOME
STATS
MANAGE
ARTICLES

全部使用类似的字体和颜色，导致阅读困难。

七、字体系统重新设计

当前截图明显存在：

WELCOME
STATS
MANAGE

过度使用等宽/打字机风格字体的问题。

不要所有东西都使用 Monospace。

建议：

UI 正文字体
Inter

或者：

Geist
Heading
Geist / Inter
Monospace

只用于：

Slug
URL
API
Code
Markdown
Technical metadata
八、颜色系统

现在整体：

黑色背景
深灰 Card
灰色文字

对比度太低。

建议：

Background
#0B0C10

Surface
#111318

Surface Elevated
#171922

Border
#272B36

Primary Text
#F5F7FA

Secondary Text
#A6ADBB

Muted Text
#707887

重点：

不要为了“高级感”把所有文字变成灰色。

标题、文章名称、按钮文字必须明显。

九、Dashboard 不要大面积空白

现在截图：

Welcome

占了很大的空间，但没有提供多少信息。

改成：

Good evening, Frank.

Here's what's happening with your content.

[ Blog ] [ Notes ] [ Drafts ] [ Media ]

Recent activity
────────────────────────

Quick actions
[ New Article ] [ New Note ] [ Upload Media ]

让 Dashboard 真正成为工作入口。

十、Editor 是这次优化的重点

这是整个 CMS 最重要的页面。

不要再做成普通：

Title
Slug
Description
Content
Save

而应该设计成：

← Back to Blog

Edit Article

┌──────────────────────────────────────────────┐
│ Title                                        │
│                                              │
│ 日本語を勉強して一年                          │
└──────────────────────────────────────────────┘

[ Write ] [ Preview ]

┌──────────────────────────────────────────────┐
│ B I U   H1 H2   🔗  🖼  `code`   • • •      │
├──────────────────────────────────────────────┤
│                                              │
│ Markdown editor                             │
│                                              │
│                                              │
└──────────────────────────────────────────────┘

──────────────────────────────────────────────

Settings

Status       Published
Category     日本語学习
Tags         Japanese / Life
Locale       ja-JP
Slug         japanese-study-one-year

──────────────────────────────────────────────

Last saved 2 minutes ago

[Save Draft]       [Preview]       [Publish]
十一、图片功能必须重新设计

这是目前最需要补完整的一块。

不要只实现：

输入 Markdown：

![xxx](url)

而应该建立完整的：

Media Library

后台：

/admin/media
十二、Media Library UI

设计：

Media

                                      + Upload

[ Search media... ] [Images] [Sort]

──────────────────────────────────────────────

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│        │ │        │ │        │ │        │
│ image  │ │ image  │ │ image  │ │ image  │
│        │ │        │ │        │ │        │
└────────┘ └────────┘ └────────┘ └────────┘

tokyo.webp
2026-09-04

japan.jpg
2026-09-03

点击图片：

Media Details

Preview

Filename
tokyo.webp

Alt Text
Tokyo street at night

URL
https://...

Uploaded
2026-09-04

[Copy URL]
[Delete]
十三、图片上传流程

支持至少四种方式。

① 点击上传
+ Upload

选择：

PNG
JPG
JPEG
WEBP
GIF
② Drag & Drop

编辑器中：

Drag image here
③ 粘贴图片

这是非常重要的。

用户从：

Windows
截图工具
浏览器
微信

复制图片以后：

Ctrl + V

直接进入 Editor。

流程：

Paste Image
      ↓
Upload API
      ↓
R2
      ↓
Create media record
      ↓
Insert Markdown

自动插入：

![Tokyo street at night](https://cdn.frank2025.com/...)
④ Media Library 插入

Editor toolbar：

🖼 Image

点击：

Insert Image

┌────────────────────────────┐
│ Media Library              │
│                            │
│ [image] [image] [image]    │
│ [image] [image] [image]    │
│                            │
│ + Upload                   │
└────────────────────────────┘

选择后自动插入文章。

十四、R2 存储

图片实际文件：

Cloudflare R2

D1：

media

只保存：

id
filename
mime_type
size
r2_key
url
alt
width
height
created_at

绝对不要把图片 Blob 存 D1。

十五、图片上传 API

建议：

POST /api/admin/media/upload

流程：

Browser
 ↓
Upload
 ↓
Admin API
 ↓
Session Check
 ↓
Validate MIME
 ↓
Validate File Size
 ↓
Generate R2 key
 ↓
R2
 ↓
D1 media
 ↓
Return URL

返回：

{
  "id": 123,
  "url": "...",
  "alt": "...",
  "width": 1920,
  "height": 1080
}
十六、图片必须支持 Alt Text

上传后立即要求：

Alt Text

例如：

Tokyo street near Shinjuku at night

插入：

![Tokyo street near Shinjuku at night](...)

这对 SEO 和无障碍都更合理。

十七、图片插入不要让用户手工写 URL

最终用户体验应该是：

写文章
 ↓
点击 🖼
 ↓
选择图片
 ↓
Insert

而不是：

打开 R2
复制 URL
回到 Markdown
手工写 Markdown
十八、Markdown Editor 增加快捷键

支持：

Ctrl + B
Ctrl + I
Ctrl + K
Ctrl + S

以及：

Ctrl + Shift + 7

有序列表。

Ctrl + Shift + 8

无序列表。

十九、Auto Save

编辑文章时：

Saving...
Saved just now

自动保存 Draft。

例如：

每 3～5 秒检测内容变化
        ↓
Debounce
        ↓
保存 Draft

不要每次键盘输入都请求 API。

二十、Preview 必须真正可用

Editor：

Write | Preview

Preview 使用和前台完全相同的 Markdown renderer。

这一点你们目前已经有：

Markdown.tsx

直接复用。

不能出现：

CMS Preview 一个样子
前台显示另一个样子
二十一、文章顶部增加状态栏

例如：

Draft

Last saved:
2026-09-04 18:42

Locale:
Japanese

Collection:
Blog

右上：

[Save Draft] [Preview] [Publish]
二十二、Blog / Notes 创建文章时自动确定 Collection

例如：

从：

/admin/blog/new

创建：

collection = blog

从：

/admin/notes/new

创建：

collection = notes

不要让用户在编辑页面手工选择 Collection。

这样可以避免：

我明明从 Notes 创建
结果保存成 Blog
二十三、Categories

后台：

/admin/categories

但是要考虑 Collection。

例如：

Blog Categories

技术
日本生活
学习
旅行
思考

Notes 可以：

Note Categories

生活
学习
随想
日记

如果现有数据模型不支持 collection-specific categories，第一阶段可以共用 Category，但 UI 中通过使用情况区分。

不要为了 UI 重写现有 schema。

二十四、Tags
/admin/tags

支持：

Search
Create
Rename
Delete
Usage count

例如：

Japanese       12
Tokyo            8
Cloudflare       7
AI               6
Life             5
二十五、Activity Log

现在虽然已经有：

admin_logs

但是应该真正做 UI：

/admin/activity

例如：

Activity

Frank Ding

● Published
  "日本語を勉強して一年"
  10 minutes ago

● Updated
  "Tokyo Life"
  2 hours ago

● Uploaded
  tokyo-night.webp
  Yesterday

● Logged in
  Today 09:32
二十六、Revision History

既然数据库已经有：

post_revisions

就不要让它变成“有表没功能”。

文章编辑页面增加：

Revision History

例如：

Revision History

Today 18:42
Frank
Updated content

Today 17:20
Frank
Updated title

Yesterday 22:31
Frank
Created article

第一阶段至少做到：

自动创建 revision
查看 revision
恢复 revision
二十七、并发编辑

如果已经设计了：

updated_at

可以实现简单的 Optimistic Lock。

进入编辑页面记录：

loaded_updated_at

保存时检查：

current_updated_at

如果不同：

⚠️ This article was modified in another session.

Your version may overwrite newer changes.

[Reload]
[Keep Editing]
二十八、Search

Blog：

Search title / slug

Notes：

Search title / slug

Media：

Search filename / alt

Tags：

Search tag

Categories：

Search category

不要每个页面都重新实现一套 Search。

做一个统一的：

SearchInput

组件。

二十九、Pagination

Blog / Notes：

20 items / page

支持：

Previous
1
2
3
...
Next

不要一次把所有文章全部加载到浏览器。

你现在 API 已经有：

limit
has_more

直接复用。

三十、Mobile

后台虽然主要用于电脑，但是必须支持：

Desktop
Tablet
Mobile

手机：

☰

展开：

Sidebar

Editor 手机上：

Toolbar

可以横向滚动。

三十一、删除操作

所有删除：

Delete

都必须二次确认。

文章：

Delete this article?

This action cannot be undone.

[Cancel] [Delete]

Media：

Delete image?

This image may be referenced by existing articles.

[Cancel] [Delete]

Media 删除尤其需要检查引用。

如果图片仍然被文章使用：

⚠️ This image is currently used by 3 articles.

不要让用户误删。

三十二、统一 Toast

所有操作统一反馈：

✓ Article saved
✓ Article published
✓ Image uploaded
✓ Category created

失败：

✕ Failed to save article

不要使用：

alert()
三十三、Loading / Empty / Error

每个页面都必须有：

Loading
Loading articles...
Empty
No articles yet.

Create your first article.

[+ New Article]
Error
Unable to load articles.

[Try Again]

不能出现现在这种：

—
—
—

用户不知道：

是 0 条数据、API 出错，还是正在加载。

三十四、Dashboard 最终结构

我建议最终：

┌──────────────────────────────────────────────┐
│ Good evening, Frank.                         │
│ Here's what's happening with your content.   │
└──────────────────────────────────────────────┘


CONTENT

┌────────────┐ ┌────────────┐ ┌────────────┐
│ Blog       │ │ Notes      │ │ Drafts     │
│ 28         │ │ 46         │ │ 7          │
│ 21 publish │ │ 39 publish │ │             │
└────────────┘ └────────────┘ └────────────┘


QUICK ACTIONS

[ + New Article ]  [ + New Note ]  [ Upload Media ]


RECENT ACTIVITY

Published "日本語を勉強して一年"
10 minutes ago

Updated "Tokyo Life"
2 hours ago

Uploaded 3 images
Yesterday

这会比现在截图的 Dashboard 好用很多。

三十五、最终 Sidebar

最终建议固定为：

FRANK CMS

Overview

CONTENT
  Blog
  Notes
  Drafts

ORGANIZE
  Categories
  Tags
  Media

SYSTEM
  Activity
  Settings

────────────────

↗ View Website
Logout
三十六、不要做的事情

这次优化 Agent 禁止：

❌ 重写整个项目
❌ 重建 D1 schema
❌ 新建第二个 posts 表
❌ 删除现有 API
❌ 删除现有 Markdown renderer
❌ 把图片存进 D1
❌ 把密码放到前端
❌ 为 Blog 和 Notes 创建两套完全重复的 Editor
❌ 为了 UI 改动破坏前台网站
❌ 使用大量动画
❌ 使用低对比度文字
❌ 所有文字使用 Monospace
❌ 使用 alert()
三十七、实施顺序

让 Agent 不要一次性全部改完，按照下面顺序：

Phase 1 — UI Foundation
Sidebar
Dashboard
Typography
Color
Spacing
Card
Button
Table
Modal
Toast
Loading
Empty State

先解决你截图中最明显的“丑 + 难读”。

Phase 2 — Content Architecture
/admin/blog
/admin/notes
/admin/drafts

将：

Posts

从主导航移除。

Phase 3 — Editor

重新设计：

Blog Editor
Notes Editor

复用一个：

PostEditor

组件。

Phase 4 — Media

完成：

/admin/media

R2 upload
D1 media
Drag & Drop
Paste
Media Picker
Alt Text
Insert Markdown
Phase 5 — Organization

完成：

Categories
Tags
Search
Pagination
Phase 6 — Revision / Activity

完成：

post_revisions
admin_logs
Activity UI
Revision UI
Optimistic Lock
Phase 7 — Security

最后检查：

CSRF
Rate Limit
Input Validation
Upload Validation
Session
Cookie
Authorization
SQL Injection
XSS
三十八、验收标准

Agent 完成后不能只告诉我：

Build successful
TypeScript successful

必须实际测试：

Blog
进入 /admin/blog
→ 新建文章
→ 保存 Draft
→ Preview
→ Publish
→ 前台出现
Notes
进入 /admin/notes
→ 新建随记
→ Publish
→ 前台 Notes 出现
Image
打开 Blog Editor
→ Ctrl+V 粘贴图片
→ 上传 R2
→ Media 创建记录
→ Markdown 自动插入
→ Preview 显示图片
→ Publish
→ 前台显示图片
Revision
修改文章
→ 自动生成 revision
→ 查看 revision
→ Restore
Concurrent editing
Session A 打开文章
Session B 修改文章
Session A 保存
→ 出现冲突提示
最后，我建议你特别强调这一点

你现在这个 CMS 不要继续围绕 Posts CRUD 来设计。

应该把它定位成：

Personal Publishing CMS

信息架构是：

                  FRANK CMS
                      │
        ┌─────────────┼─────────────┐
        │             │             │
      Blog          Notes         Drafts
        │             │
        └─────────────┼─────────────┘
                      │
                  Post Editor
                      │
       ┌──────────────┼──────────────┐
       │              │              │
   Categories       Tags           Media
                                     │
                                     ▼
                                  R2 + D1