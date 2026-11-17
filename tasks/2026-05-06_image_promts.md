I would like to create a printable (and possibly also online) game where a rabbit has to reach a carrot in an obstacle course. The game will have 4x4 grid of grass cells with obstacles - pond, rock, predator etc. The player has to choose the moves - up, down, left, right to reach the carrot and avoid obstacles. In the more complex version there can be predators that move, e.g. fox walking left, right, left, right etc, or a hunter that blocks the whole row or column (from his place to an obstacle).

As a first step, please generate a few text to image promnts for:
* A happy rabbit sitting on a green grass field
* A carrot
* backend grass field
* fox
* pond
* rock
* a fireplace

use a tetxured digital concept art style or painted adventure game illustration with visible, layered and deliverate brushstrokes though having  hard edges and sharp clear composition. All as a digital illustration. 

Any questions?

---

**Solution:**

Generated text-to-image prompts:

**1. Happy Rabbit**
> A happy, cute rabbit, top-down RPG perspective (side-view object), isolated on a solid white background. Textured digital concept art style, painted adventure game illustration. Visible, layered, and deliberate brushstrokes, hard edges, sharp clear composition, digital illustration.

**2. Carrot**
> A cute, appetizing bright orange carrot, partially hidden buried in the ground with fresh green leafy tops sticking out, subtle magical glitter sparkles around it. Top-down RPG perspective (side-view object), isolated on a solid white background. Textured digital concept art style, painted adventure game illustration. Visible, layered, and deliberate brushstrokes, hard edges, sharp clear composition, digital illustration.

**3. Background Grass Field**
> A seamless, light vibrant green grass field, sparse grass with a few small flowers scattered, purely top-down game tile texture. Textured digital concept art style, painted adventure game illustration. Visible, layered, and deliberate brushstrokes, hard edges, sharp clear composition, digital illustration.

**3b. Background Grass Field (Surrounded by Pebbles)**
> A seamless, light vibrant green grass field, sparse grass with a few small flowers scattered, surrounded by a subtle border of small, natural grey pebbles outlining the edges of the game tile, purely top-down game tile texture. Textured digital concept art style, painted adventure game illustration. Visible, layered, and deliberate brushstrokes, hard edges, sharp clear composition, digital illustration.

**4. Fox (Predator)**
> A cunning, stylized orange fox sitting, looking alert, top-down RPG perspective (side-view object), isolated on a solid white background. Textured digital concept art style, painted adventure game illustration. Visible, layered, and deliberate brushstrokes, hard edges, sharp clear composition, digital illustration.

**5. Pond (Obstacle)**
> A small, serene blue water pond, top-down RPG perspective, isolated on a solid white background. Textured digital concept art style, painted adventure game illustration. Visible, layered, and deliberate brushstrokes, hard edges, sharp clear composition, digital illustration.

**6. Rock (Obstacle)**
> A sturdy, grey stone rock obstacle, top-down RPG perspective (side-view object), isolated on a solid white background. Textured digital concept art style, painted adventure game illustration. Visible, layered, and deliberate brushstrokes, hard edges, sharp clear composition, digital illustration.

**7. Fireplace (Obstacle)**
> A warm, glowing campfire or small stone fireplace, top-down RPG perspective (side-view object), isolated on a solid white background. Textured digital concept art style, painted adventure game illustration. Visible, layered, and deliberate brushstrokes, hard edges, sharp clear composition, digital illustration.

**Questions:**
- The images are being generated with a solid white background for the objects, and the perspective is "side-view object for top-down game". 
- Do these image generations meet your expectations for the game's visuals?

---

**Web Page App Development Solution:**

I have initialized a Vanilla JS + Vite project in this directory and built the browser web page based on your requirements.
- **Grid Setup:** A 4x4 grid using `background_grass_surrounded.png` as the background.
- **Objects:** Uses `happy_rabbit.png`, `carrot.png`, and the 4 obstacle PNGs randomly chosen (`rock`, `pond`, `fox`, `fireplace`). 
- **Difficulty:** Random placement with 3 difficulty buttons (Easy = 2 obstacles, Medium = 4, Hard = 6). The rabbit and carrot always spawn on opposite sides of the grid so it's a real journey.
- **UI:** A kid-friendly, highly colorful and responsive layout with large emojis for arrow paths (⬆️, ⬇️, ⬅️, ➡️).
- **Controls:** Players can click the large arrows to add them to their path sequence, click any arrow inside their path sequence to remove it, and hit the large "🏃 GO!" button to watch the rabbit animate cell by cell.

**Questions for the next phases:**
1. **PDF Export:** For the future printable PDF generation (game field + 6x4 arrows page), would you prefer using a client-side library like `jsPDF` so the user can dynamically generate and download the exact level they are currently looking at, or should it be a separate pre-generated catalog?
2. **Manual Editor:** When we build the manual editor mode later, should kids be able to drag-and-drop obstacles directly onto the grid themselves, or should the editor be hidden behind a "parent/teacher mode"?
3. **Animations/Sounds:** Would you like to add simple sound effects (e.g., a "boing" sound when hopping, or a "crunch" sound when reaching the carrot) to make it more engaging for a 6-year-old?
4. **Testing:** You can run `npm run dev` in the project directory right now to test the game! Let me know if you want any immediate layout adjustments.

---

**Final Polish & Documentation:**

- **Fail State Update:** When the player fails, the game now only resets the rabbit's position and clears the sequence block, rather than generating an entirely new layout. This allows the child to iteratively figure out the exact same puzzle.
- **Documentation:** A comprehensive `README.md` has been created outlining the gameplay loop, difficulty parameters, technical features (like the BFS reachability checks), and the PDF Print layout system.