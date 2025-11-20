import { defineConfig } from 'tsup';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],  // Use ESM with esbuild, we'll wrap it in IIFE ourselves
  globalName: 'CipherPaySDK',
  outDir: 'dist/browser',
  minify: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  platform: 'browser',
  target: 'es2020',
  treeshake: true,
  esbuildOptions(options) {
    options.define = {
      ...options.define,
      'global': 'globalThis',
      'process.env.NODE_ENV': '"production"',
    };
    options.alias = {
      ...options.alias,
    };
    // Don't inject buffer - we'll provide it in the banner instead
    // This ensures it's available globally before any bundle code runs
    options.inject = [];
    options.plugins = options.plugins || [];
    // Add polyfill-node plugin FIRST
    options.plugins.unshift(
      polyfillNode({
        polyfills: {
          fs: true,
          path: true,
          url: true,
          crypto: true,
        },
        globals: {
          Buffer: true,
          process: true,
        },
      })
    );
    // Add a plugin to handle Node.js built-in modules
    options.plugins.push({
      name: 'node-modules-polyfill',
      setup(build) {
        // Resolve Node.js built-in modules to polyfills
        build.onResolve({ filter: /^(crypto|node:crypto|fs\/promises|node:fs\/promises|url|node:url|path|node:path)$/ }, (args) => {
          return { path: args.path, namespace: 'node-polyfill' };
        });
        
        build.onLoad({ filter: /.*/, namespace: 'node-polyfill' }, (args) => {
          // Crypto polyfill
          if (args.path.includes('crypto')) {
            return {
              contents: `
                export const createHash = () => {
                  throw new Error('createHash not available in browser');
                };
                export const randomBytes = (size) => {
                  const arr = new Uint8Array(size);
                  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                    crypto.getRandomValues(arr);
                  }
                  return arr;
                };
                export const randomFillSync = (buffer) => {
                  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                    crypto.getRandomValues(buffer);
                  }
                  return buffer;
                };
              `,
              loader: 'js',
            };
          }
          
          // fs/promises polyfill
          if (args.path.includes('fs')) {
            return {
              contents: `
                export const readFile = async () => {
                  throw new Error('fs.readFile is not available in browser. Load files via HTTP instead.');
                };
                export const writeFile = async () => {
                  throw new Error('fs.writeFile is not available in browser.');
                };
              `,
              loader: 'js',
            };
          }
          
          // url polyfill
          if (args.path.includes('url')) {
            return {
              contents: `
                export const fileURLToPath = (url) => {
                  if (typeof url === 'string') {
                    return url.replace(/^file:\\/\\//, '');
                  }
                  return url.pathname || '';
                };
                export const pathToFileURL = (path) => {
                  return 'file://' + path;
                };
              `,
              loader: 'js',
            };
          }
          
          // path polyfill
          if (args.path.includes('path')) {
            return {
              contents: `
                export const dirname = (path) => {
                  const parts = path.split('/');
                  parts.pop();
                  return parts.join('/') || '/';
                };
                export const resolve = (...paths) => {
                  return paths.join('/').replace(/\\/\\//g, '/');
                };
                export const join = (...paths) => {
                  return paths.join('/').replace(/\\/\\//g, '/');
                };
                export const basename = (path) => {
                  return path.split('/').pop() || '';
                };
              `,
              loader: 'js',
            };
          }
          
          return { contents: '', loader: 'js' };
        });
      },
    });
  },
  noExternal: ['circomlibjs', 'zod'],
  banner: {
    js: `
      // Browser polyfills for Node.js modules - MUST RUN FIRST
      (function() {
        var globalObj = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
        
        // Buffer polyfill - CRITICAL: Must be available globally before ANY bundle code runs
        (function() {
          var BufferImpl = function Buffer(arg, offset, length) {
            if (!(this instanceof BufferImpl)) {
              return new BufferImpl(arg, offset, length);
            }
            var buf;
            if (typeof arg === 'number') {
              buf = new Uint8Array(arg);
              if (length !== undefined && typeof offset === 'number') {
                buf.fill(offset);
              }
            } else if (typeof arg === 'string') {
              var bytes = new TextEncoder().encode(arg);
              buf = new Uint8Array(bytes);
            } else if (arg instanceof ArrayBuffer) {
              buf = new Uint8Array(arg, offset || 0, length);
            } else if (arg instanceof Uint8Array) {
              buf = new Uint8Array(arg);
            } else if (Array.isArray(arg)) {
              buf = new Uint8Array(arg);
            } else if (arg && typeof arg.length === 'number') {
              buf = new Uint8Array(arg.length);
              for (var i = 0; i < arg.length; i++) {
                buf[i] = (arg[i] & 0xFF);
              }
            } else {
              buf = new Uint8Array(0);
            }
            Object.setPrototypeOf(buf, BufferImpl.prototype);
            return buf;
          };
          
          BufferImpl.prototype = Object.create(Uint8Array.prototype);
          
          // Add writeUInt32BE and other common Buffer methods
          BufferImpl.prototype.writeUInt32BE = function(value, offset) {
            offset = offset >>> 0;
            value = +value;
            this[offset] = (value >>> 24);
            this[offset + 1] = (value >>> 16);
            this[offset + 2] = (value >>> 8);
            this[offset + 3] = (value & 0xff);
            return offset + 4;
          };
          
          BufferImpl.prototype.writeUInt32LE = function(value, offset) {
            offset = offset >>> 0;
            value = +value;
            this[offset + 3] = (value >>> 24);
            this[offset + 2] = (value >>> 16);
            this[offset + 1] = (value >>> 8);
            this[offset] = (value & 0xff);
            return offset + 4;
          };
          
          BufferImpl.prototype.readUInt32BE = function(offset) {
            offset = offset >>> 0;
            return ((this[offset] << 24) | (this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3]) >>> 0;
          };
          
          BufferImpl.prototype.readUInt32LE = function(offset) {
            offset = offset >>> 0;
            return ((this[offset]) | (this[offset + 1] << 8) | (this[offset + 2] << 16) | (this[offset + 3] << 24)) >>> 0;
          };
          
          BufferImpl.from = function(data, encoding) {
            if (typeof data === 'string') {
              return new BufferImpl(new TextEncoder().encode(data));
            }
            if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
              return new BufferImpl(data);
            }
            if (Array.isArray(data)) {
              return new BufferImpl(data);
            }
            return new BufferImpl(0);
          };
          
          BufferImpl.alloc = function(size, fill) {
            var buf = new Uint8Array(size);
            if (fill !== undefined) {
              buf.fill(typeof fill === 'number' ? fill : 0);
            }
            Object.setPrototypeOf(buf, BufferImpl.prototype);
            return buf;
          };
          
          BufferImpl.allocUnsafe = function(size) {
            return BufferImpl.alloc(size);
          };
          
          BufferImpl.isBuffer = function(obj) {
            return obj instanceof Uint8Array || (obj && obj.buffer && obj.buffer instanceof ArrayBuffer);
          };
          
          BufferImpl.concat = function(list, totalLength) {
            if (!Array.isArray(list)) return new BufferImpl(0);
            var len = totalLength;
            if (len === undefined) {
              len = 0;
              for (var i = 0; i < list.length; i++) {
                len += list[i].length;
              }
            }
            var result = new Uint8Array(len);
            var pos = 0;
            for (var j = 0; j < list.length && pos < len; j++) {
              var item = list[j];
              if (item instanceof Uint8Array) {
                var copyLen = Math.min(item.length, len - pos);
                result.set(item.subarray(0, copyLen), pos);
                pos += copyLen;
              }
            }
            Object.setPrototypeOf(result, BufferImpl.prototype);
            return result;
          };
          
          // Set Buffer globally on ALL possible global objects
          globalObj.Buffer = BufferImpl;
          if (typeof window !== 'undefined') window.Buffer = BufferImpl;
          if (typeof global !== 'undefined') global.Buffer = BufferImpl;
          if (typeof self !== 'undefined') self.Buffer = BufferImpl;
        })();
        
        
        // Process polyfill - required for browser compatibility
        if (typeof process === 'undefined') {
          globalObj.process = {
            env: {
              NODE_ENV: 'production'
            },
            browser: true,
            version: '',
            versions: {},
            nextTick: function(fn) {
              setTimeout(fn, 0);
            },
            cwd: function() {
              return '/';
            },
            exit: function(code) {
              throw new Error('process.exit called with code ' + code);
            }
          };
          if (typeof window !== 'undefined') {
            window.process = globalObj.process;
          }
        }
        
        // Provide require function for dynamic requires in bundled code
        if (typeof require === 'undefined') {
          globalObj.require = function(id) {
            if (id === 'crypto' || id === 'node:crypto') {
              var cryptoObj = typeof globalObj.crypto !== 'undefined' ? globalObj.crypto : (typeof window !== 'undefined' && window.crypto ? window.crypto : {});
              return {
                createHash: function() {
                  throw new Error('crypto.createHash is not available in browser. Use Web Crypto API instead.');
                },
                randomBytes: function(size) {
                  var arr = new Uint8Array(size);
                  if (cryptoObj.getRandomValues) {
                    cryptoObj.getRandomValues(arr);
                  } else {
                    throw new Error('crypto.randomBytes is not available: no getRandomValues');
                  }
                  return arr;
                },
                randomFillSync: function(buffer) {
                  var cryptoObj2 = typeof globalObj.crypto !== 'undefined' ? globalObj.crypto : (typeof window !== 'undefined' && window.crypto ? window.crypto : {});
                  if (cryptoObj2.getRandomValues) {
                    cryptoObj2.getRandomValues(buffer);
                  } else {
                    throw new Error('crypto.randomFillSync is not available: no getRandomValues');
                  }
                  return buffer;
                }
              };
            }
            if (id === 'buffer') {
              return { Buffer: globalObj.Buffer };
            }
            throw new Error('Dynamic require of "' + id + '" is not supported in browser bundle. Required: ' + id);
          };
        }
      })();
    `,
  },
});

