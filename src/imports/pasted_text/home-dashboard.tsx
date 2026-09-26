Create Screen 021 — AI Home Dashboard for the Houzeify AI Construction Advisor web app.

This is the primary logged-in homeowner dashboard and the central Phase 1 product screen.

BRAND:
Use the official supplied Houzeify logo and standalone H icon.
Do not redraw or modify the logo.

Brand name:
Houzeify

Primary:
#722ED1

Background:
#FBF9F7

White:
#FFFFFF

Ivory:
#F4F0EC

Text:
#242326

Secondary:
#68636D

Muted:
#9A949D

Border:
#E3DDD7

Lavender:
#F3EAFF

TYPOGRAPHY:
Google Sans Flex — headlines, large numbers, AI responses.
Open Sans — body, navigation, buttons and descriptions.
Sometype Mono — technical labels, project metadata and AI system states.

IMPORTANT VISUAL STYLE:
Premium AI SaaS workspace.
Minimal.
Warm.
Intelligent.
Modern.
Calm.

Use soft circular blurred ambient shapes using #722ED1 and #F3EAFF.

DO NOT use:
floor plans
architectural drawings
construction photos
stock photography
human AI avatars
robots
3D houses
heavy glassmorphism
neon effects.

FRAME:
1440 × 900 desktop.
Responsive for 1280, 1024, 768 and 390 × 844.

==================================================
APP SHELL
==================================================

Create a desktop SaaS application layout.

LEFT SIDEBAR:
Width:
240px.

Background:
#FFFFFF.

Right border:
1px #E3DDD7.

Top:
Official Houzeify logo.

Navigation:

Home
AI Advisor
Projects
Estimates
BOQ
Plan Analysis

Divider.

Tools:

Material Calculator
Reports

Bottom:

Help
Settings

Use simple outline icons.

Active Home:
#F3EAFF background.
#722ED1 icon and text.
12px radius.

Sidebar typography:
Open Sans
13px.

==================================================
TOP HEADER
==================================================

Main content header height:
72px.

Left:
Page title:

Home

Google Sans Flex
20px
600
#242326

Right:

Notification icon.

Help icon.

User avatar:

AK

Purple background:
#722ED1

Small dropdown arrow.

==================================================
MAIN CONTENT
==================================================

Main content max width:
1120px.

Page padding:
32px desktop.

Create a two-column dashboard.

LEFT:
approximately 65%.

RIGHT:
approximately 35%.

==================================================
WELCOME SECTION
==================================================

Eyebrow:

YOUR CONSTRUCTION WORKSPACE

Sometype Mono
10px
letter spacing 0.1em
#722ED1

Headline:

Good morning, Adarsh.

Google Sans Flex
36px
600
#242326

Second line:

Let's build something smart.

Google Sans Flex
36px
600
#722ED1

Description:

Hozie is ready to help you plan your construction project.

Open Sans
14px
#68636D.

==================================================
HOZIE AI CARD
==================================================

This is the HERO element of the dashboard.

Create a large white card.

Width:
100%.

Height:
approximately 300px.

Border:
1px #E3DDD7.

Radius:
24px.

Very subtle shadow.

Use a soft lavender glow behind the Hozie icon.

HEADER:

Official HOUZEIFY H icon:
40px.

Next:

HOZIE

AI CONSTRUCTION ADVISOR

HOZIE:
Google Sans Flex
16px
600.

AI CONSTRUCTION ADVISOR:
Sometype Mono
9px
#722ED1.

Right:

● READY

Purple status dot.

MAIN MESSAGE:

What would you like to build today?

Google Sans Flex
26px
500
#242326.

Supporting text:

Tell me what you're planning and I'll help you estimate the cost, materials and work involved.

Open Sans
14px
#68636D.

==================================================
AI QUICK ACTIONS
==================================================

Create four compact action chips/cards:

Create a project
Get an estimate
Analyze a plan
Calculate materials

Each:

White / #FBF9F7 background.
Border #E3DDD7.
12px radius.
Height 44px.

Hover:
#F3EAFF
border #722ED1.

==================================================
AI COMPOSER
==================================================

At bottom of Hozie card:

Large input:

"What are you planning to build?"

Height:
56px.

White background.
1px #E3DDD7 border.
14px radius.

Left:
small H icon.

Right:
Purple send button 40px.

Send button:
#722ED1.

==================================================
RECENT PROJECT
==================================================

Below Hozie card:

Section label:

YOUR PROJECTS

Sometype Mono
10px
#722ED1.

Create one featured project card:

3 BHK G+1 HOUSE

Hyderabad

2,400 SQ FT

Status:
Planning

Estimated:
₹29.8L – ₹35.2L

Progress:
18%

Use a thin progress bar.

Card:
White.
Border #E3DDD7.
16px radius.

CTA:

Continue project →

==================================================
RIGHT COLUMN
==================================================

Create three compact cards.

CARD 1:
PROJECT SNAPSHOT

Current project:

3 BHK G+1 House

Location:
Hyderabad

Area:
2,400 sq ft

Status:
Planning

==================================================
CARD 2:
AI INSIGHT

HOZIE SUGGESTS

"Start by confirming your plot size and number of floors."

Small H icon.

Purple accent.

Button:

Continue →

==================================================
CARD 3:
QUICK TOOLS

Material Calculator
Estimate
BOQ
Upload Plan

Use a simple 2 × 2 grid.

==================================================
EMPTY STATE
==================================================

Also create an alternate state for users without a project.

Instead of Recent Project show:

READY TO BUILD?

Create your first construction project with Hozie.

Button:

Create project →

==================================================
AI VISUAL LANGUAGE
==================================================

Hozie is represented only by the official Houzeify H icon.

Do NOT use:
human face
girl
robot
3D mascot.

Use subtle purple glow around the H icon when AI is active.

==================================================
BACKGROUND
==================================================

Use #FBF9F7.

Add 2–3 large soft blurred circular shapes.

Use:
#722ED1
#F3EAFF

Very low opacity.

One behind the Hozie card.
One upper-right.
One bottom-left.

No floor plans.

==================================================
RESPONSIVE
==================================================

1280:
Keep sidebar 220px.
Reduce dashboard content width.

1024:
Sidebar becomes 72px icon-only.

768:
Hide sidebar.
Use top navigation.

390:
Single-column layout.

Mobile:

Top bar:
H icon
Home
notifications
avatar

Welcome:
28px headline.

Hozie card:
full width.

Quick actions:
2 × 2.

Project card:
full width.

Right-column cards move below project.

==================================================
STATES
==================================================

Create:

1. New User / No Project
2. Active Project
3. AI Thinking
4. AI Response
5. Empty Projects
6. Loading

AI THINKING:

H icon with subtle purple pulse.

Text:

Hozie is thinking...

Sometype Mono
10px.

AI RESPONSE:

Show a short conversational response inside the Hozie card.

Example:

"Based on your project, I recommend starting with the plot dimensions and number of floors."

==================================================
FIGMA STRUCTURE
==================================================

SCREEN 021 / AI HOME

App Shell
Sidebar
Header
Welcome
Hozie AI Card
Quick Actions
AI Composer
Projects
Project Card
Project Snapshot
AI Insight
Quick Tools
Ambient Blur

Create reusable components:

Sidebar
Navigation Item
Hozie Header
AI Composer
Quick Action
Project Card
Insight Card
Tool Card
Status Badge
Progress Bar

Use Auto Layout.

==================================================
INTERACTIONS
==================================================

Create a project
→ Screen 031 Create Project

Get an estimate
→ Hozie opens with estimate prompt

Analyze a plan
→ Screen 071 Upload Plan

Calculate materials
→ Screen 063 Material Calculator

Continue project
→ Screen 084 Project Detail

AI Advisor
→ Screen 022 AI Advisor

==================================================
DESIGN QUALITY
==================================================

The dashboard should NOT feel like a traditional analytics dashboard.

Hozie AI must be the dominant element.

The user should immediately understand:

1. Where they are.
2. What Hozie can do.
3. What project they are working on.
4. What they should do next.

Keep the UI clean, spacious and premium.

Use #722ED1 consistently as the Houzeify primary color.

Use the exact Houzeify logo assets.

Use the brand name:
Houzeify.