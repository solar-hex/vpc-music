I'll analyze the design and implement it on the setlists page. The image shows a professional, organized worship setlist management interface with:

- Header with "SETLISTS" title and subtitle
- Filter tabs (Reorder, Override Keys, Tags, Archive) at the top
- Main section showing "ACTIVE SETLISTS" with 3 cards displaying setlist details (duration, song count, key range, flow, tags, performers, and action buttons)
- Drag-and-drop reorder functionality
- Right sidebar showing archived setlists organized by month


Let me read the current setlists page and implement this design:

Explore • 2 FilesNow let me see more of the page to understand the full structure:

Found view mode renderingNow I'll redesign the view mode section to match the provided design. I need to update the header, add filter tabs, reorganize the setlist cards with more detailed information, add the archived setlists sidebar, and implement drag-and-drop reordering for setlists. Let me replace the view mode section:

Added filter mode trackingNow let me add the imports needed for the new design:

Updated icon importsNow let me replace the view mode rendering to match the design:

Implemented new professional design with filter tabs, detailed cards, and archived sidebarNow I need to add the missing Star icon import:

Updated imports with Star iconv134+312/-58RestoreNow let me verify the build compiles successfully:

Build verification completeThe build compiled successfully. The setlists page has been completely redesigned to match the professional layout from your image. The new design includes:

**Key Features Implemented:**

- Professional header with "SETLISTS" title and action buttons
- Filter tabs for Reorder, Override Keys, Tags, and Archive modes
- Active setlists displayed as detailed cards showing: status badge, title, duration, song count, key range, flow percentage, category tags, and performer information
- Hover-state action buttons (Edit, Archive, Delete)
- Grid view toggle buttons
- Drag-and-drop reorder hint for reorganizing setlists
- Right sidebar showing archived setlists organized by month with restore/delete options
- Gold accent colors (`#C09060`) throughout with premium dark theme aesthetic
- Smooth Framer Motion animations with staggered card reveals


The page now provides a comprehensive, organized setlist management experience matching the professional worship planning system design you provided.