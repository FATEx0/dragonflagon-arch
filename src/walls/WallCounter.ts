import ARCHITECT from "../core/architect.js";
import CounterUI from "../core/CounterUI.js";

export default class WallsCounter {
	private static _counter = new CounterUI(0, 'Walls');
	static init() {
		libWrapper.register(ARCHITECT.MOD_NAME, 'WallsLayer.prototype.activate', (wrapped: Function) => {
			wrapped();
			this.updateCount();
			this._counter.render(true);
		}, 'WRAPPER');
		libWrapper.register(ARCHITECT.MOD_NAME, 'WallsLayer.prototype.deactivate', (wrapped: Function) => {
			wrapped();
			if (this._counter.rendered)
				this._counter.close();
		}, 'WRAPPER');
		Hooks.on('createWall', () => this.updateCount());
		Hooks.on('deleteWall', () => this.updateCount());
		Hooks.on('updateWall', () => this.updateCount());
	}

	static updateCount() {
		const objects = canvas.walls.objects.children as Wall[];
		this._counter.count = objects.length;
		var doors = 0;
		var moves = 0;
		var sight = 0;
		var sound = 0;
		objects.forEach(x => {
			if (x.data.door) doors++;
			if (x.data.move) moves++;
			if (x.data.sense > 0) sight++;
			if (x.data.sound > 0) sound++;
		});
		this._counter.hint = `Doors: ${doors}
Move Blocking: ${moves}
Sight Blocking: ${sight}
Sound Blocking: ${sound}`;
	}
}