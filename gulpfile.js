const gulp = require('gulp');
const prefix = require('gulp-autoprefixer');
const sass = require('gulp-sass')(require('sass'));
const yaml = require('gulp-yaml');

/* ----------------------------------------- */
/*  Compile Sass
/* ----------------------------------------- */

const SYSTEM_SCSS = ["styles/src/**/*.scss"];
function compileScss() {
  // Configure options for sass output. For example, 'expanded' or 'nested'
  let options = {
    outputStyle: 'compressed'
  };
  return gulp.src(SYSTEM_SCSS)
    .pipe(sass(options))
    .pipe(prefix({
      cascade: false
    }))
    .pipe(gulp.dest("./styles/dist"))
}
const cssTask = gulp.series(compileScss);

/* ----------------------------------------- */
/*  Compile YAML
/* ----------------------------------------- */
const SYSTEM_YAML = ['./yaml/**/*.yml', './yaml/**/*.yaml'];
function compileYaml() {
  return gulp.src(SYSTEM_YAML)
    .pipe(yaml({ space: 2 }))
    .pipe(gulp.dest('./'))
}
const yamlTask = gulp.series(compileYaml);

/* ----------------------------------------- */
/*  Watch Updates
/* ----------------------------------------- */

function watchUpdates() {
  gulp.watch(SYSTEM_SCSS, cssTask);
  gulp.watch(SYSTEM_YAML, yamlTask);
  // gulp.watch(SYSTEM_SCRIPTS, scripts);
}

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

exports.default = gulp.series(
  compileScss,
  // compileScripts,
  watchUpdates
);
exports.css = cssTask;
exports.yaml = yamlTask;
exports.build = gulp.parallel(cssTask, yamlTask);
// exports.scripts = scripts;
