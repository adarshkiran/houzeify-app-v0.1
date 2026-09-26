Create Screen 031 — Create Project for the Houzeify AI Construction Advisor web app.

This is the first structured project creation screen after the homeowner interacts with Hozie.

BRAND:
Use official supplied Houzeify logo and H icon.
Brand name: Houzeify
Primary: #722ED1
Background: #FBF9F7
White: #FFFFFF
Ivory: #F4F0EC
Text: #242326
Secondary: #68636D
Muted: #9A949D
Border: #E3DDD7
Lavender: #F3EAFF

Typography:
Google Sans Flex — headlines.
Open Sans — forms, body and buttons.
Sometype Mono — eyebrows, progress and technical labels.

VISUAL STYLE:
Premium AI SaaS.
Clean, spacious and intelligent.
Use soft circular blurred ambient shapes using #722ED1 and #F3EAFF at low opacity.

DO NOT use:
floor plans
architectural drawings
construction photography
stock images
human AI avatars
robots
3D houses
heavy glassmorphism.

FRAME:
1440 × 900 desktop.
Responsive 390 × 844 mobile.

==================================================
APP SHELL
==================================================

Use the same Houzeify application shell as Screen 022.

Sidebar:
Home
AI Advisor
Projects
Estimates
BOQ
Plan Analysis

Divider

Material Calculator
Reports

Bottom:
Help
Settings

Projects is active:
#F3EAFF background
#722ED1 icon/text.

==================================================
HEADER
==================================================

Main header:

Create project

Right:
Cancel

Use Google Sans Flex:
20px
600.

==================================================
PROGRESS
==================================================

Show:

01 PROJECT
02 DETAILS
03 ESTIMATE

Current step:
01 PROJECT

Progress:
33%

Use Sometype Mono:
10px.

Active:
#722ED1

Inactive:
#E3DDD7

==================================================
MAIN CONTENT
==================================================

Centered content width:
900px.

Eyebrow:

NEW CONSTRUCTION PROJECT

Sometype Mono
10px
#722ED1

Headline:

Let's create your project.

Google Sans Flex
40px
600
#242326

Description:

Hozie will use these details to build your construction estimate.

Open Sans
15px
#68636D.

==================================================
PROJECT FORM CARD
==================================================

White card.
Border #E3DDD7.
Radius 20px.
Padding 32px.

FIELD 1:

Project name

Input:
"My New Home"

Helper:
Give your project a name you'll recognize later.

FIELD 2:

What are you building?

Show selected property type:

House

Small badge:
HOME

This value is pre-filled from Screen 008.

Allow:
Change

FIELD 3:

Where are you building?

Input:
Hyderabad, Telangana

Location icon.

Pre-filled from Screen 008.

Link:
Change location

FIELD 4:

What stage are you at?

Create 4 selectable cards:

Planning
Just exploring ideas.

Have a plan
I already have drawings.

Ready to estimate
I know the basic requirements.

Ready to build
Looking for contractors soon.

Cards:
White.
1px #E3DDD7.
12px radius.

Selected:
#F3EAFF background.
2px #722ED1 border.

==================================================
HOZIE TIP
==================================================

Small inline card below form:

[H icon]

HOZIE TIP

"You don't need everything ready.
We can start with what you know and fill in the details later."

Background:
#F3EAFF.

Border:
none.

Radius:
12px.

==================================================
PRIMARY ACTION
==================================================

Button:

Continue to project details →

Height:
52px.

Width:
240px.

#722ED1 background.
White text.
12px radius.

Disabled until:
Project name + stage selected.

==================================================
SECONDARY
==================================================

Back to Hozie

Text button.
#68636D.

==================================================
RIGHT DECORATIVE VISUAL
==================================================

Do not create a large illustration.

Use only subtle soft circular blurred purple/lavender shapes behind the form.

One large blurred circle:
#722ED1
low opacity.

Two smaller:
#F3EAFF.

Keep the form visually dominant.

==================================================
RESPONSIVE
==================================================

Desktop:
Centered 900px form.

Tablet:
Form width 90%.

Mobile:
20px side padding.
Single column.
Project cards stacked.
Full-width Continue button.

Hide desktop sidebar on mobile.

Mobile headline:
30px.

==================================================
INTERACTIONS
==================================================

Project name:
Editable.

Property type:
Pre-filled from onboarding.

Location:
Pre-filled from onboarding.

Stage:
Single selection.

Continue:
Navigate to Screen 032 — Project Details.

Save the following project context:

project_name
property_type
location
project_stage
user_role = homeowner

==================================================
FIGMA STRUCTURE
==================================================

SCREEN 031 / CREATE PROJECT

App Shell
Header
Progress
Intro
Project Form
Project Name
Property Type
Location
Project Stage
Hozie Tip
Primary Button
Secondary Action
Ambient Blur

Create reusable components:

Input
Selection Card
Badge
Progress Step
Hozie Tip
Primary Button

Use Auto Layout.

Keep the screen simple.

Do not ask for:
budget
plot size
built-up area
number of floors
number of bedrooms
materials
contractor
architect
interior designer

Those belong to later project steps.

Use #722ED1 as the Houzeify primary color.
Use "Houzeify" exactly.