import { useEffect, useRef, useState, useCallback } from 'react'

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 640
const LANE_COUNT = 3
const LANE_WIDTH = CANVAS_WIDTH / LANE_COUNT
const TARGET_SCORE = 1000

const PLAYER = {
  width: 44,
  height: 72,
  color: '#22c55e',
}

const ENEMY = {
  width: 44,
  height: 72,
  color: '#ef4444',
}

const loadStats = () => {
  try {
    const raw = localStorage.getItem('racingGameStats')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        wins: Number(parsed.wins) || 0,
        losses: Number(parsed.losses) || 0,
        highScore: Number(parsed.highScore) || 0,
      }
    }
  } catch {
    // ignore
  }
  return { wins: 0, losses: 0, highScore: 0 }
}

const saveStats = (stats) => {
  localStorage.setItem('racingGameStats', JSON.stringify(stats))
}

export default function Game() {
  const canvasRef = useRef(null)
  const requestRef = useRef(null)
  const stateRef = useRef({
    playerLane: 1,
    targetLane: 1,
    playerX: CANVAS_WIDTH / 2,
    enemies: [],
    roadOffset: 0,
    spawnTimer: 0,
    speed: 4,
    lastTime: 0,
    score: 0,
    passedEnemies: new Set(),
  })

  const [gameState, setGameState] = useState('idle') // idle | running | won | crashed
  const [score, setScore] = useState(0)
  const [stats, setStats] = useState(loadStats)

  const resetGame = useCallback(() => {
    const state = stateRef.current
    state.playerLane = 1
    state.targetLane = 1
    state.playerX = CANVAS_WIDTH / 2
    state.enemies = []
    state.roadOffset = 0
    state.spawnTimer = 0
    state.speed = 4
    state.score = 0
    state.passedEnemies = new Set()
    state.lastTime = performance.now()
    setScore(0)
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    setGameState('running')
  }, [resetGame])

  const endGame = useCallback(
    (result) => {
      setGameState(result)
      setStats((prev) => {
        const next = {
          ...prev,
          highScore: Math.max(prev.highScore, Math.floor(stateRef.current.score)),
          wins: result === 'won' ? prev.wins + 1 : prev.wins,
          losses: result === 'crashed' ? prev.losses + 1 : prev.losses,
        }
        saveStats(next)
        return next
      })
    },
    []
  )

  const changeLane = useCallback((direction) => {
    if (gameState !== 'running') return
    const state = stateRef.current
    state.targetLane = Math.max(0, Math.min(LANE_COUNT - 1, state.targetLane + direction))
  }, [gameState])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        changeLane(-1)
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        changeLane(1)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (gameState === 'idle' || gameState === 'won' || gameState === 'crashed') {
          startGame()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [changeLane, gameState, startGame])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const spawnEnemy = () => {
      const lane = Math.floor(Math.random() * LANE_COUNT)
      const x = lane * LANE_WIDTH + LANE_WIDTH / 2
      const id = Math.random().toString(36).slice(2)
      stateRef.current.enemies.push({
        id,
        lane,
        x,
        y: -ENEMY.height,
        width: ENEMY.width,
        height: ENEMY.height,
      })
    }

    const checkCollision = (rect1, rect2) => {
      return (
        rect1.x - rect1.width / 2 < rect2.x + rect2.width / 2 &&
        rect1.x + rect1.width / 2 > rect2.x - rect2.width / 2 &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
      )
    }

    const drawCar = (x, y, width, height, color, isPlayer = false) => {
      ctx.save()
      ctx.translate(x, y)

      // Body
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(-width / 2, 0, width, height, 8)
      ctx.fill()

      // Roof
      ctx.fillStyle = isPlayer ? '#16a34a' : '#b91c1c'
      ctx.beginPath()
      ctx.roundRect(-width / 2 + 6, 18, width - 12, 32, 5)
      ctx.fill()

      // Windshield
      ctx.fillStyle = '#bfdbfe'
      ctx.beginPath()
      ctx.roundRect(-width / 2 + 8, 22, width - 16, 14, 3)
      ctx.fill()

      // Headlights
      ctx.fillStyle = '#fef08a'
      ctx.beginPath()
      ctx.roundRect(-width / 2 + 3, isPlayer ? 0 : height - 8, 10, 6, 2)
      ctx.roundRect(width / 2 - 13, isPlayer ? 0 : height - 8, 10, 6, 2)
      ctx.fill()

      // Tail lights
      ctx.fillStyle = '#f87171'
      ctx.beginPath()
      ctx.roundRect(-width / 2 + 3, isPlayer ? height - 6 : 2, 10, 5, 2)
      ctx.roundRect(width / 2 - 13, isPlayer ? height - 6 : 2, 10, 5, 2)
      ctx.fill()

      ctx.restore()
    }

    const drawRoad = () => {
      // Grass
      ctx.fillStyle = '#14532d'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Road
      ctx.fillStyle = '#374151'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Lane markings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 4
      ctx.setLineDash([32, 32])
      ctx.lineDashOffset = -stateRef.current.roadOffset

      for (let i = 1; i < LANE_COUNT; i++) {
        ctx.beginPath()
        ctx.moveTo(i * LANE_WIDTH, -32)
        ctx.lineTo(i * LANE_WIDTH, CANVAS_HEIGHT)
        ctx.stroke()
      }

      ctx.setLineDash([])

      // Side lines
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(3, 0)
      ctx.lineTo(3, CANVAS_HEIGHT)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(CANVAS_WIDTH - 3, 0)
      ctx.lineTo(CANVAS_WIDTH - 3, CANVAS_HEIGHT)
      ctx.stroke()
    }

    const update = (time) => {
      const state = stateRef.current
      const dt = Math.min((time - state.lastTime) / 16.67, 2)
      state.lastTime = time

      if (gameState !== 'running') return

      // Smooth lane transition
      const targetX = state.targetLane * LANE_WIDTH + LANE_WIDTH / 2
      state.playerX += (targetX - state.playerX) * 0.18 * dt
      state.playerLane = state.targetLane

      // Increase difficulty over time
      state.speed = Math.min(10, 4 + state.score / 300)

      // Move road
      state.roadOffset += state.speed * dt
      if (state.roadOffset >= 64) state.roadOffset -= 64

      // Spawn enemies
      state.spawnTimer -= dt
      if (state.spawnTimer <= 0) {
        spawnEnemy()
        state.spawnTimer = Math.max(25, 70 - state.score / 20)
      }

      // Update enemies
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i]
        enemy.y += state.speed * dt

        // Score for passing enemy
        if (!state.passedEnemies.has(enemy.id) && enemy.y > CANVAS_HEIGHT - PLAYER.height - 20) {
          state.passedEnemies.add(enemy.id)
          state.score += 50
        }

        // Remove off-screen enemies
        if (enemy.y > CANVAS_HEIGHT) {
          state.enemies.splice(i, 1)
        }
      }

      // Base score for distance
      state.score += (state.speed * dt) / 5

      // Update React state every frame
      setScore(state.score)

      // Check collisions
      const playerRect = {
        x: state.playerX,
        y: CANVAS_HEIGHT - PLAYER.height - 24,
        width: PLAYER.width - 8,
        height: PLAYER.height - 8,
      }

      for (const enemy of state.enemies) {
        const enemyRect = {
          x: enemy.x,
          y: enemy.y + 4,
          width: enemy.width - 8,
          height: enemy.height - 8,
        }
        if (checkCollision(playerRect, enemyRect)) {
          endGame('crashed')
          return
        }
      }

      // Check win condition
      if (state.score >= TARGET_SCORE) {
        endGame('won')
      }
    }

    const render = () => {
      drawRoad()

      const state = stateRef.current
      const playerY = CANVAS_HEIGHT - PLAYER.height - 24
      drawCar(state.playerX, playerY, PLAYER.width, PLAYER.height, PLAYER.color, true)

      for (const enemy of state.enemies) {
        drawCar(enemy.x, enemy.y, enemy.width, enemy.height, ENEMY.color, false)
      }
    }

    const loop = (time) => {
      update(time)
      render()
      requestRef.current = requestAnimationFrame(loop)
    }

    requestRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(requestRef.current)
  }, [gameState, endGame])

  const handleCanvasClick = (e) => {
    if (gameState !== 'running') return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const state = stateRef.current
    const currentX = state.targetLane * LANE_WIDTH + LANE_WIDTH / 2
    if (x < currentX) {
      changeLane(-1)
    } else {
      changeLane(1)
    }
  }

  const statusText = {
    idle: '按空格键或点击下方按钮开始',
    running: '躲避红色车辆，达到 1000 分获胜！',
    won: '🎉 恭喜获胜！',
    crashed: '💥 撞车了！',
  }

  return (
    <div className="game-wrapper">
      <div className="game-header">
        <h1>🏎️ 极速赛车</h1>
        <p className="game-status">{statusText[gameState]}</p>
      </div>

      <div className="game-layout">
        <div className="canvas-area">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            className="game-canvas"
          />
          {gameState !== 'running' && (
            <div className="overlay">
              <div className="overlay-content">
                <h2>
                  {gameState === 'idle' && '准备好了吗？'}
                  {gameState === 'won' && '你赢了！'}
                  {gameState === 'crashed' && '游戏结束'}
                </h2>
                {gameState !== 'idle' && (
                  <p>本局得分：<strong>{Math.floor(score)}</strong></p>
                )}
                <button className="start-btn" onClick={startGame}>
                  {gameState === 'idle' ? '开始游戏' : '再来一局'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="score-panel">
          <div className="stat-card current-score">
            <span className="stat-label">当前得分</span>
            <span className="stat-value">{Math.floor(score)}</span>
          </div>
          <div className="stat-card target-score">
            <span className="stat-label">目标得分</span>
            <span className="stat-value">{TARGET_SCORE}</span>
          </div>
          <div className="stat-card high-score">
            <span className="stat-label">最高分</span>
            <span className="stat-value">{stats.highScore}</span>
          </div>
          <div className="stat-card wins">
            <span className="stat-label">胜场</span>
            <span className="stat-value">{stats.wins}</span>
          </div>
          <div className="stat-card losses">
            <span className="stat-label">败场</span>
            <span className="stat-value">{stats.losses}</span>
          </div>
          <div className="stat-card total">
            <span className="stat-label">总场次</span>
            <span className="stat-value">{stats.wins + stats.losses}</span>
          </div>

          <div className="controls-help">
            <h3>操作说明</h3>
            <p>← → 方向键</p>
            <p>A / D 键</p>
            <p>点击画面左右侧</p>
            <p>空格键：开始 / 重来</p>
          </div>
        </div>
      </div>
    </div>
  )
}
