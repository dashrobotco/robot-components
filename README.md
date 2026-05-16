# Robot Components

React components from the Robot Design System.

## Installation

```bash
npm install robot-components
```

## Components

### Task Panel

A draggable task panel with physics-based interactions.

```tsx
import { TaskPanel } from 'robot-components';

function App() {
  const tasks = [
    { id: '1', name: 'cosmic-nebula', status: 'processing' },
    { id: '2', name: 'azure-crystal', status: 'completed', size: '12.5 MB' },
  ];

  return (
    <TaskPanel
      tasks={tasks}
      onTaskClear={(id) => console.log('Clear task:', id)}
      onClearAll={() => console.log('Clear all')}
    />
  );
}
```

#### Features

- **Drag & throw** with real momentum
- **Bounces** off screen edges with damping
- **Impact sounds** that scale with velocity
- **Lifts up** with deeper shadow while dragging
- **Spring-animated** expand/collapse
- **Touch support** for mobile

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `tasks` | `TaskItem[]` | Array of tasks to display |
| `config` | `Partial<TaskPanelConfig>` | Optional configuration overrides |
| `onPositionChange` | `(x, y) => void` | Callback when panel moves |
| `onSizeChange` | `(w, h) => void` | Callback when panel resizes |
| `onBounce` | `(x, y, intensity) => void` | Callback on edge bounce |
| `onTaskClear` | `(taskId) => void` | Callback when task is cleared |
| `onClearAll` | `() => void` | Callback when all tasks cleared |
| `soundUrl` | `string` | Custom sound file URL |

#### TaskItem

```ts
interface TaskItem {
  id: string;
  name: string;
  status: 'completed' | 'processing';
  size?: string;
  thumbnail?: string;
  gradient?: string;
}
```

### Node Editor Canvas

An interactive node editor with draggable panels, connections, and physics.

#### Features

- **Click to spawn** nodes anywhere on the canvas
- **Drag & throw** panels with momentum and edge bouncing
- **Connect panels** by dragging from corner handles
- **Slice connections** by dragging through lines
- **Resize panels** from edges and corners
- **Keyboard shortcuts**: Shift for grid snap, Cmd+drag for scale from center
- **Dynamic dot grid** that responds to panel movement
- **WebGL noise overlay** for visual texture

### Dial Menu

A radial node-spawn menu with 3D mouse tilt, paged categories, and tactile sound feedback.

```tsx
import { DialMenu, type DialNodeType } from 'robot-components';

function App() {
  const [menu, setMenu] = useState({ isOpen: false, position: { x: 0, y: 0 } });

  return (
    <div onClick={(e) => setMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY } })}>
      <DialMenu
        isOpen={menu.isOpen}
        position={menu.position}
        onSelect={(type: DialNodeType) => console.log('Selected:', type)}
        onClose={() => setMenu(m => ({ ...m, isOpen: false }))}
      />
    </div>
  );
}
```

#### Features

- **3D mouse tilt** with per-button parallax and brightness response
- **Mouse-follow drift** with quintic gravity once the cursor leaves the ring
- **Scroll/trackpad paging** through 7 categories (Core, AI, Data, Logic, Design, Photo, Video)
- **Scramble-text** page-name reveal and rotating segment indicator
- **Staggered reveal** of items with pitched click feedback
- **Click-outside / Esc** to dismiss
- Requires `/images/radial-decoration.svg` and `/hoverfx2.mp3` in your `public/` folder

### Demo

Run the demo to see all components in action:

```bash
npm run dev
```

Then visit:
- http://localhost:3000 - Component overview
- http://localhost:3000/taskpanel - Task Panel demo
- http://localhost:3000/nodegrid - Node Editor demo
- http://localhost:3000/dialmenu - Dial Menu demo

## Peer Dependencies

- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `framer-motion` >= 10.0.0
- `lucide-react` >= 0.300.0
- `tailwindcss` >= 4.0.0

## Development

```bash
# Install dependencies
npm install

# Run demo site
npm run dev

# Build library
npm run build
```

## Extending with Claude Code

This repo includes Claude Code skills to help you customize and expand the components—no coding experience required.

### Setup

1. Install [Claude Code](https://claude.ai/claude-code) if you haven't already
2. Clone this repository:
   ```bash
   git clone https://github.com/dashrobotco/robot-components.git
   cd robot-components
   ```
3. Open Claude Code in the project directory:
   ```bash
   claude
   ```

### Available Skills

#### `/node-editor-expand`

Use this command to add features to the Node Editor Canvas:

```
/node-editor-expand Add a glow effect around panels when selected
```

```
/node-editor-expand Add double-click to edit panel content
```

```
/node-editor-expand Add Cmd+D to duplicate the selected panel
```

```
/node-editor-expand Add magnetic snapping when panels get close to each other
```

### Tips for Best Results

- **Be specific**: "Add a button in the top-right corner of each panel"
- **Describe interactions**: "Add a color picker on right-click with 6 preset colors"
- **Reference existing behavior**: "Add wobble animation like the bounce effect"
- **Mention edge cases**: "Ask for confirmation before deleting connected panels"

## License

MIT
