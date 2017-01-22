// The play state contains the game
var playState = function () { };

// configurations depending on who I am

var initial_position = undefined;
playState.prototype =
    {
        // Setup functions
        preload: function () {
            // Function called first to load all the assets
            game.load.image('island_placeholder', 'src/graphics/PLACEHOLDER.png');
            game.load.image('wave_placeholder1', 'src/graphics/PLACEHOLDERWAVE.png');
            game.load.image('wave_placeholder2', 'src/graphics/bomb.png')
            game.load.image('wave_placeholder3', 'src/graphics/beach_ball.png')
            game.load.image('background', 'src/graphics/water.png');

            game.load.spritesheet('wave', 'src/graphics/wave.png', 20, 63);
            game.load.audio('main_audio', 'src/audio/test.mp3')
            game.load.spritesheet('kaboom', 'src/graphics/explode.png', 128, 128);

            this.initial_position = {
                1: { x: game.width / 2, y: 0 },
                2: { x: game.width, y: game.height / 2 },
                3: { x: game.width / 2, y: game.height },
                4: { x: 0, y: game.height / 2 },
            }

            this.player_number = socket.player_number;
            this.players = {};
        },
        create: function () {
            self = this;
            /// Networking
            // Player events
            if (isMaster()) {
                socket.on('player connected', function (new_player) {
                    self.addPlayer(new_player.player_number);
                });

                socket.on('player update',function(data){
                    for(var k in data.keys){
                        networkControllers[data.player_number][k] = data.keys[k];
                    }
                });
            } else {
                socket.on('player update', function (data) {
                    // update the position of the player
                    // for player in data.players:
                    //      if player not in my list... add
                    for(var p in data.players){
                        p = data.players[p];
                        // if we don't have this player... add it
                        if (self.players[p.player_number] === undefined) {
                            console.log('updates because of player info');
                            self.addPlayer(p.player_number);
                        }
                        // update the players that we do have
                        if (p.player_number in self.players){
                            self.players[p.player_number].position.set(p.x, p.y);
                        }
                    }
                });
            }

            // Scoring definitions
            this.score = 0;
            this.scoreString = '';
            this.scoreText;
            var lives;

            //  Music
            music = game.add.audio('main_audio');
            music.play();
            // Music controls
            mute_key = game.input.keyboard.addKey(Phaser.Keyboard.M);
            mute_key.onDown.add(mute, this);

            // Group definitions
            islands = game.add.group();
            powerups = game.add.group();

            // Create own island
            this.addPlayer(this.player_number);

            // Score
            this.scoreString = 'Score : ';
            this.scoreText = game.add.text(10, 10, this.scoreString + this.score, { font: '34px Arial', fill: '#fff' });

            // Lives
            lives = game.add.group();
            game.add.text(game.world.width - 100, 10, 'Lives : ', { font: '34px Arial', fill: '#fff' });

            // Explosion pool
            explosions = game.add.group();
            explosions.createMultiple(300, 'kaboom');
            explosions.forEach(explosion, this);
            function explosion(island) {
                island.anchor.x = 0.5;
                island.anchor.y = 0.5;
                island.animations.add('kaboom');
            }
        },
        update: function () {
            // Collision
            game.physics.arcade.collide(islands, islands);
            for (var i in islands.children) {
                game.physics.arcade.collide(islands, islands.children[i].weapon.bullets, islandBulletCollisionHandler, null, this);
            }

            /// Networking
            data = {
                x: island.x,
                y: island.y
            };
            if (!isMaster() && isPlayer()) {
                console.log('FUCK');
                keys = {};
                var controller = this.players[this.player_number].controls;
                for (var k in controller) {
                    v = controller[k];
                    keys[k] = keyPressed(v);
                    console.log(v, keyPressed(v));
                }
                data['keys'] = keys;
            }
            if(isMaster()){
                data.players = this.getPlayersInfo();
            }
            socket.emit('sync', data);
        },

        // Helper Functions
        addPlayer: function (player_number) {
            if (!isPlayer(player_number)) return;

            // Define controller
            console.log('Adding player:', player_number);
            if (isMe(player_number))
                controller = Controller();
            else
                controller = addNetworkController(player_number);

            // Create island
            var new_island = IslandFactory(
                islands,
                this.initial_position[player_number].x,
                this.initial_position[player_number].y,
                'island_placeholder',
                'wave',
                controller
            );
            // Add the island player to the list of players
            this.players[player_number] = new_island;
        },
        getPlayersInfo: function () {
            var info = [];
            for (player_number in this.players) {
                var player = this.players[player_number];
                var data = {};
                data.player_number = player_number;
                data.x = player.x;
                data.y = player.y;
                info.push(data);
            }
            return info;
        },
    };


function islandBulletCollisionHandler(island, bullet) {
    //  When a bullet hits an alien we kill them both
    bullet.kill();

    //  Increase the score
    this.score += 1;
    this.scoreText.text = this.scoreString + this.score;

    //  And create an explosion :)
    var explosion = explosions.getFirstExists(false);
    explosion.reset(island.x, island.y);
    explosion.play('kaboom', 30, false, true);
}

function mute() {
    if (music.isPlaying) {
        music.pause()
    }
    else {
        music.resume();
    }
}
