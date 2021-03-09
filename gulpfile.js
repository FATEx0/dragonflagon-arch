const gulp = require('gulp');
var fs = require('fs')
const del = require('del');
const ts = require('gulp-typescript');
const sourcemaps = require('gulp-sourcemaps');
const zip = require('gulp-zip');
const rename = require('gulp-rename');
const minify = require('gulp-minify');
const tabify = require('gulp-tabify');
const stringify = require('json-stringify-pretty-compact');

const GLOB = '**/*';
const DIST = 'dist/';
const BUNDLE = 'bundle/';
const SOURCE = 'src/';
const LANG = 'lang/';
const TEMPLATES = 'templates/';
const CSS = 'css/';

var PACKAGE = JSON.parse(fs.readFileSync('package.json'));
var DEV_DIR = fs.readFileSync('dev').toString().trim();
function reloadPackage(cb) { PACKAGE = JSON.parse(fs.readFileSync('package.json')); cb(); }
function DEV_DIST() { return DEV_DIR + PACKAGE.name + '/'; }
console.log(DEV_DIST());

String.prototype.replaceAll = function (pattern, replace) { return this.split(pattern).join(replace); }
function pdel(patterns, options) { return desc(`deleting ${patterns}`, () => { return del(patterns, options); }); }
function plog(message) { return desc('plog', (cb) => { cb(); console.log(message); }); }
/**
 * Sets the gulp name for a lambda expression
 * @param {string} name Name to be bound to the lambda
 * @param {Function} lambda Expression to be named
 * @returns {Function} lambda
 */
function desc(name, lambda) {
	Object.assign(lambda, { displayName: name });
	return lambda;
}

/**
 * Compile the source code into the distribution directory
 * @param {Boolean} keepSources Include the TypeScript SourceMaps
 */
function buildSource(keepSources, minifySources = false, output = null) {
	return desc('build Source', () => {
		var stream = gulp.src(SOURCE + GLOB);
		if (keepSources) stream = stream.pipe(sourcemaps.init())
		stream = stream.pipe(ts.createProject("tsconfig.json")())
		if (keepSources) stream = stream.pipe(sourcemaps.write({
			sourceRoot: file =>
				'../'.repeat(file.path
					.split('src/')[1]
					.split('/').length - 1) || './'
		}))
		if (minifySources) stream = stream.pipe(minify({
			ext: { min: '.js' },
			mangle: false,
			noSource: true
		}));
		else stream = stream.pipe(tabify(4, false));
		return stream.pipe(gulp.dest((output || DIST) + SOURCE));
	});
}

exports.step_buildSourceDev = gulp.series(buildSource(true, false, DEV_DIST()));
exports.step_buildSource = gulp.series(buildSource(true));
exports.step_buildSourceMin = gulp.series(buildSource(false, true));

function copyDevDistToLocalDist() {
	return gulp.src(DEV_DIST() + SOURCE + GLOB).pipe(gulp.dest(DIST + SOURCE));
}

/**
 * Builds the module manifest based on the package, sources, and css.
 */
function buildManifest(output = null) {
	const files = []; // Collector for all the file paths
	return desc('build Manifest', (cb) => gulp.src(PACKAGE.main) // collect the source files
		.pipe(rename({ extname: '.js' })) // rename their extensions to `.js`
		.pipe(gulp.src(CSS + GLOB)) // grab all the CSS files
		.on('data', file => files.push(file.path.replace(file.base, file.base.replace(file.cwd + '/', '')))) // Collect all the file paths
		.on('end', () => { // output the filepaths to the module.json
			if (files.length == 0)
				throw Error('No files found in ' + SOURCE + GLOB + " or " + CSS + GLOB);
			const js = files.filter(e => e.endsWith('js')); // split the CSS and JS files
			const css = files.filter(e => e.endsWith('css'));
			fs.readFile('module.json', (err, data) => {
				const module = data.toString() // Inject the data into the module.json
					.replaceAll('{{name}}', PACKAGE.name)
					.replaceAll('{{title}}', PACKAGE.title)
					.replaceAll('{{version}}', PACKAGE.version)
					.replaceAll('{{description}}', PACKAGE.description)
					.replace('"{{sources}}"', stringify(js, { indent: '\t' }))
					.replace('"{{css}}"', stringify(css, { indent: '\t' }));
				fs.writeFile((output || DIST) + 'module.json', module, cb); // save the module to the distribution directory
			});
		}));
}
exports.step_buildManifest = buildManifest();

function outputLanguages(output = null) { return desc('output Languages', () => gulp.src(LANG + GLOB).pipe(gulp.dest((output || DIST) + LANG))); }
function outputTemplates(output = null) { return desc('output Templates', () => gulp.src(TEMPLATES + GLOB).pipe(gulp.dest((output || DIST) + TEMPLATES))); }
function outputStylesCSS(output = null) { return desc('output Styles CSS', () => gulp.src(CSS + GLOB).pipe(gulp.dest((output || DIST) + CSS))); }
function outputMetaFiles(output = null) { return desc('output Meta Files', () => gulp.src(['LICENSE', 'README.md', 'CHANGELOG.md']).pipe(gulp.dest((output || DIST)))); }

/**
 * Copy files to module named directory and then compress that folder into a zip
 */
function compressDistribution() {
	return gulp.series(
		// Copy files to folder with module's name
		() => gulp.src(DIST + GLOB)
			.pipe(gulp.dest(DIST + `${PACKAGE.name}/${PACKAGE.name}`))
		// Compress the new folder into a ZIP and save it to the `bundle` folder
		, () => gulp.src(DIST + PACKAGE.name + '/' + GLOB)
			.pipe(zip(PACKAGE.name + '.zip'))
			.pipe(gulp.dest(BUNDLE))
		// Copy the module.json to the bundle directory
		, () => gulp.src(DIST + '/module.json')
			.pipe(gulp.dest(BUNDLE))
		// Cleanup by deleting the intermediate module named folder
		, pdel(DIST + PACKAGE.name)
	);
}
exports.step_compress = compressDistribution();

/**
 * Simple clean command
 */
exports.clean = gulp.series(pdel([DIST, BUNDLE]));
exports.devClean = gulp.series(pdel([DEV_DIST()]));
/**
 * Default Build operation
 */
exports.default = gulp.series(
	pdel([DIST])
	, gulp.parallel(
		buildSource(true, false)
		, buildManifest()
		, outputLanguages()
		, outputTemplates()
		, outputStylesCSS()
		, outputMetaFiles()
	)
	, plog('Build Complete')
);
/**
 * Extends the default build task by copying the result to the Development Environment
 */
exports.dev = gulp.series(
	pdel([DIST + GLOB, DEV_DIST() + GLOB], { force: true }),
	gulp.parallel(
		buildSource(true, false, DEV_DIST())
		, buildManifest(DEV_DIST())
		, outputLanguages(DEV_DIST())
		, outputTemplates(DEV_DIST())
		, outputStylesCSS(DEV_DIST())
		, outputMetaFiles(DEV_DIST())
	)
	, copyDevDistToLocalDist
	// , outputDistToDevEnvironment
	, plog('Dev Build Complete')
);
/**
 * Performs a default build and then zips the result into a bundle
 */
exports.zip = gulp.series(
	pdel([DIST])
	, gulp.parallel(
		buildSource(false, false)
		, buildManifest()
		, outputLanguages()
		, outputTemplates()
		, outputStylesCSS()
		, outputMetaFiles()
	)
	, compressDistribution()
	, pdel([DIST])
	, plog('Release Complete')
);
/**
 * Sets up a file watch on the project to detect any file changes and automatically rebuild those components.
 */
exports.watch = function () {
	exports.default();
	gulp.watch(SOURCE + GLOB, gulp.series(pdel(DIST + SOURCE), buildSource(true, false)));
	gulp.watch([CSS + GLOB, 'module.json', 'package.json'], buildManifest());
	gulp.watch(LANG + GLOB, gulp.series(pdel(DIST + LANG), outputLanguages()));
	gulp.watch(TEMPLATES + GLOB, gulp.series(pdel(DIST + TEMPLATES), outputTemplates()));
	gulp.watch(CSS + GLOB, gulp.series(pdel(DIST + CSS), outputStylesCSS()));
	gulp.watch(['LICENSE', 'README.md', 'CHANGELOG.md'], outputMetaFiles());
}
/**
 * Sets up a file watch on the project to detect any file changes and automatically rebuild those components, and then copy them to the Development Environment.
 */
exports.devWatch = function () {
	const devDist = DEV_DIST();
	console.log('Dev Directory: ' + devDist);
	exports.dev();
	gulp.watch(SOURCE + GLOB, gulp.series(pdel([devDist + SOURCE + GLOB, DIST + SOURCE + GLOB], { force: true }), buildSource(true, false, devDist), copyDevDistToLocalDist, plog('sources done.')));
	gulp.watch([CSS + GLOB, 'module.json', 'package.json'], gulp.series(reloadPackage, buildManifest(devDist), plog('manifest done.')));
	gulp.watch(LANG + GLOB, gulp.series(pdel(devDist + LANG + GLOB, { force: true }), outputLanguages(devDist), plog('langs done.')));
	gulp.watch(TEMPLATES + GLOB, gulp.series(pdel(devDist + TEMPLATES + GLOB, { force: true }), outputTemplates(devDist), plog('templates done.')));
	gulp.watch(CSS + GLOB, gulp.series(pdel(devDist + CSS + GLOB, { force: true }), outputStylesCSS(devDist), plog('css done.')));
	gulp.watch(['LICENSE', 'README.md', 'CHANGELOG.md'], gulp.series(outputMetaFiles(devDist), plog('metas done.')));
}
