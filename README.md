# Voxel Blast Soccer ⚽💥

Open-source 3D voxel soccer with explosive voxel destruction. Play in the browser!

**🎮 Play Now:** [https://sky510019437-wq.github.io/voxel-blast-soccer/](https://sky510019437-wq.github.io/voxel-blast-soccer/)

## What is this?

Voxel Blast Soccer is an arcade-style 3D football game where destruction is the star. Smash the ball through voxel scenery and watch it EXPLODE into flying chunks. Score goals, demolish walls, and enjoy the satisfying chaos of voxel physics.

### Features

- ⚡ **Fast-paced arcade gameplay** - Quick matches, instant action
- 💥 **Destructible voxel environments** - Advertising boards, stands, and barriers shatter on impact
- 🎯 **Physics-based ball control** - Dribble, kick, and blast your way to victory
- 🤖 **AI opponent** - Smart enough to challenge you
- 🎨 **Chunky voxel aesthetics** - High-contrast, retro-modern style
- 🔊 **Procedural sound effects** - Dynamic audio that reacts to the action
- 📱 **Browser-based** - No installation required, runs on any modern browser

### Controls

- **WASD / Arrow Keys** - Move your player
- **Space / Click** - Kick the ball
- **Mouse** - Look around / aim
- **P** - Pause

## 中文说明 (Chinese)

**体素爆破足球** - 一个街机风格的3D体素足球游戏，破坏系统是核心玩法。将球踢向体素场景，观看它爆炸成飞舞的碎块。

**控制方式：**
- WASD / 方向键 - 移动
- 空格 / 点击 - 踢球
- 鼠标 - 转向
- P - 暂停

**特色：**
- 可破坏的体素环境
- 物理引擎驱动的球控
- AI对手
- 动态音效和相机震动

## Development

### Prerequisites

- Node.js 18+ and npm

### Local Development

```bash
# Clone the repository
git clone https://github.com/sky510019437-wq/voxel-blast-soccer.git
cd voxel-blast-soccer

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The dev server will start at `http://localhost:5173/`

### Technology Stack

- **Three.js** - 3D rendering
- **Cannon-es** - Physics engine
- **Vite** - Build tool and dev server
- **Vanilla JavaScript** - No framework overhead

## Deployment

This project is configured for automatic deployment to GitHub Pages. Every push to the `main` branch triggers a build and deploy.

### ⚠️ REQUIRED: Enable GitHub Pages First

**Before the workflow can deploy, you MUST enable GitHub Pages:**

1. Go to your repository **Settings** → **Pages**
   - Direct link: https://github.com/sky510019437-wq/voxel-blast-soccer/settings/pages
2. Under **Source**, select **GitHub Actions** (not "Deploy from a branch")
3. Save the settings
4. The next push to `main` will automatically build and deploy

**After enabling Pages, the game will be available at:**
`https://sky510019437-wq.github.io/voxel-blast-soccer/`

### Current Status

✅ Code is ready  
✅ Build workflow is configured  
⏳ Waiting for GitHub Pages to be enabled in repository settings

Once Pages is enabled, the game will deploy automatically on the next commit or you can manually trigger the workflow from the Actions tab.

## Architecture

The game uses an Entity-Component pattern:

- **Physics**: Cannon-es handles collision detection and rigid body dynamics
- **Rendering**: Three.js renders voxels using instanced geometry for performance
- **Voxel Destruction**: On collision, static voxels are converted to dynamic debris with individual physics bodies
- **Juice**: Camera shake, procedural audio, and particle effects make every action feel impactful

Performance optimizations:
- Instanced voxel rendering where possible
- Debris pool with a maximum cap (200 chunks)
- Simple frustum culling via Three.js
- Fixed timestep physics (60 FPS)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

---

**Made with ❤️ and voxels**
