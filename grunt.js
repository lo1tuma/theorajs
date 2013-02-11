// grunt build file

module.exports = function(grunt) {

	var sourceList = [
		"src/Theora.js",
		"src/stream/ByteStream.js",
		"src/stream/AjaxStream.js",
		//"src/stream/LocalFileStream.js",
		"src/ogg/Ogg.js",
		"src/ogg/Page.js",
		"src/ogg/Packet.js",
		"src/ogg/LogicalStream.js",
		"src/ogg/TransportStream.js",
		"src/theora/Theora.js",
		"src/theora/Util.js",
		"src/theora/Constants.js",
		"src/theora/MappingTables.js",
		"src/theora/Header.js",
		"src/theora/Frame.js",
		"src/theora/Decoder.js",
	];

	// load exec plugin
	grunt.loadTasks('tools/grunt-exec/tasks');

	// Project configuration.
	grunt.initConfig({
		pkg: "<json:package.json>",
		concat: {
			// development build
			development: {
				src: sourceList,
				dest: "build/<%= pkg.name %>-<%= pkg.version %>.js"
			},
			
			// productive build
			production: {
				src: sourceList,
				dest: "build/<%= pkg.name %>-<%= pkg.version %>.js"
			}
		},
		min: {
			production: {
				src: "<config:concat.production.dest>",
				dest: "build/<%= pkg.name %>-<%= pkg.version %>.min.js"
			}
		},
		exec: {
			yuidoc: {
				command: "yuidoc",
				stdout: true
			}
		}
	});

	grunt.registerTask("documentation", "exec");
	grunt.registerTask("default", "documentation concat min");
	grunt.registerTask("development", "documentation concat:development");
	grunt.registerTask("production", "documentation concat:production min:production");

};
