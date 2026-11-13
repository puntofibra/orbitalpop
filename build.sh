#!/bin/bash
cd "$(dirname "$0")"
cat src/p1_head.html src/p2_base.js src/p3_board.js src/p4_game.js src/p5_ui.js > index.html
