import ARCHITECT from "../core/architect";

interface Invert { inverted: boolean };

class _AltLightInverted {
	ready() {
		libWrapper.register(ARCHITECT.MOD_NAME, 'LightingLayer.prototype._onDragLeftMove',
			this._onDragLeftMove.bind(canvas.lighting), 'WRAPPER');
		Hooks.on('renderAmbientLightConfig', this._renderLightConfig.bind(this));
	}
	private _onDragLeftMove(this: LightingLayer, wrapper: Function, event: PIXI.InteractionEvent) {
		const preview = (event.data as any).preview as AmbientLight;
		if (event.data.originalEvent.altKey) {
			if (!(preview.data.flags['df-architect'] as Invert)?.inverted) {
				preview.data.flags['df-architect'] = { inverted: true }
				preview.data.config.luminosity = -preview.data.config.luminosity;
			}
		} else {
			if ((preview.data.flags['df-architect'] as Invert)?.inverted) {
				delete preview.data.flags['df-architect'];
				preview.data.config.luminosity = -preview.data.config.luminosity;
			}
		}
		return wrapper(event);
	}
	private _renderLightConfig(app: AmbientLightConfig, html: JQuery<HTMLElement>, data: any) {
		const button = $(`<button type="button" style="flex:0;padding-left:8.5px" name="invert-radius" title="${'DF_ARCHITECT.AltLightInverted.InvertLuminosityButton'.localize()}"><i class="fas fa-adjust"></i></button>`);
		html.find('input[name="config.luminosity"]').parent().before(button);
		button.on('click', (event) => {
			event.preventDefault();
			const luminosity = html.find('input[name="config.luminosity"]');
			luminosity.val((-parseFloat(<string>luminosity.val())));
			luminosity.trigger('change');
		});
	}
}

export const AltLightInverted = new _AltLightInverted();