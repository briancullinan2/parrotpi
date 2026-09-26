// ZERO DEPENDENCY BARE-BONES JAVASCRIPT FILE-SYSTEM FOR
//   POSIX WEB-ASSEMBLY
const VFS_NOW = 3;
const ST_FILE = 8;
const ST_DIR = 4;

// 438 = 0o666
const FS_DEFAULT = (6 << 3) + (6 << 6) + (6);
const FS_FILE = (ST_FILE << 12) + FS_DEFAULT;
const FS_DIR = (ST_DIR << 12) + FS_DEFAULT;

// (33206 & (((1 << 3) - 1) << 3) >> 3 = 6
const S_IRGRP = ((1 << 3) - 1) << 3;
const S_IRUSR = ((1 << 3) - 1) << 6;
const S_IROTH = ((1 << 3) - 1) << 0;

const ENOENT = 9968;
const R_OK = 1;
const W_OK = 2;
const X_OK = 3;
const F_OK = 4;



/**
 * Centered Helper to enforce 100% path string consistency across all operations
 */
function normalizeVfsPath(path)
{
	if(!path) return "";
	let localName = path.trim();

	// Convert duplicate backslashes/slashes
	localName = localName.replace(/\\/g, '/').replace(/\/+/g, '/');

	// Strip trailing or helper roots to align with lookups
	if(!localName.startsWith('/')) localName = '/' + localName;
	if(!localName.startsWith('/base')) localName = '/base' + localName;
	if(localName.endsWith('/.')) localName = localName.substring(0, localName.length - 2);
	if(localName.startsWith('../lib/')) localName = 'lib/' + localName.substring(7);

	return localName;
}

function path_openNew(dirfd, lookupflags, pathPtr, pathLen, oflags, rights_base, rights_inheriting, fdflags, openedFdPtr)
{
	const buffer = Module.memory.buffer;
	const rawPath = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// Resolve clean key mapping context
	const localName = normalizeVfsPath(rawPath);

	const O_CREAT = 1;
	const O_DIRECTORY = 2;
	const O_EXCL = 4;
	const O_TRUNC = 8;

	const exists = typeof FS.virtual[localName] !== 'undefined' && FS.virtual[localName] !== null;

	if(!exists)
	{
		if(oflags & O_CREAT)
		{
			FS.virtual[localName] = {
				contents: new Uint8Array(0),
				timestamp: new Date(),
				mode: (oflags & O_DIRECTORY) ? FS_DIR : FS_FILE,
				size: 0,
				path: localName,
				parent: localName.includes('/') ? localName.substring(0, localName.lastIndexOf('/')) : ''
			};
		} else
		{
			return 44; // WASI_ENOENT
		}
	} else
	{
		if((oflags & O_CREAT) && (oflags & O_EXCL)) return 20; // WASI_EEXIST
		if(oflags & O_TRUNC)
		{
			FS.virtual[localName].contents = new Uint8Array(0);
		}
	}

	const rb = BigInt(rights_base);
	const canRead = (rb & 2n) !== 0n;
	const canWrite = (rb & 64n) !== 0n;
	const modeStr = (canRead ? 'r' : '') + (canWrite ? 'w' : '');
	const view = new DataView(Module.memory.buffer);

	FS.filePointer++;
	const currentFd = FS.filePointer;

	debugger;
	FS.pointers[currentFd] = [
		0, // Position seek tracking index
		modeStr,
		FS.virtual[localName],
		localName,
		currentFd,
		api?.pid || 42
	];

	view.setUint32(openedFdPtr, currentFd, true);
	return 0; // WASI_ESUCCESS
}

function path_filestat_getNew(dirfd, lookupflags, pathPtr, pathLen, bufPtr)
{
	const buffer = Module.memory.buffer;
	const rawPath = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));
	const localName = normalizeVfsPath(rawPath);

	const file = FS.virtual[localName];
	if(!file) return 44; // WASI_ENOENT

	const view = new DataView(buffer);
	new Uint8Array(buffer, bufPtr, 64).fill(0);

	view.setBigUint64(bufPtr + 0, BigInt(dirfd), true);

	const myNode = FS.pointers.find(p => p && p[3] === localName);
	const inodeIndex = myNode ? myNode[4] : 999;
	view.setBigUint64(bufPtr + 8, BigInt(inodeIndex), true);

	const isDir = (file.mode >> 12) === 4;
	view.setUint8(bufPtr + 16, isDir ? ST_UNSTABLE_DIR : ST_UNSTABLE_FILE);
	view.setUint32(bufPtr + 20, 1, true);

	const size = isDir ? 0n : BigInt(file.contents?.length || 0);
	view.setBigUint64(bufPtr + 24, size, true);

	const timeNs = BigInt(file.timestamp.getTime()) * 1000000n;
	view.setBigUint64(bufPtr + 32, timeNs, true);
	view.setBigUint64(bufPtr + 40, timeNs, true);
	view.setBigUint64(bufPtr + 48, timeNs, true);

	return 0; // WASI_ESUCCESS
}

function path_unlink_fileNew(dirfd, pathPtr, pathLen)
{
	const buffer = Module.memory.buffer;
	const rawPath = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));
	const localName = normalizeVfsPath(rawPath);

	const file = FS.virtual[localName];
	if(!file) return 44; // WASI_ENOENT

	if((file.mode >> 12) === 4) return 31; // WASI_EISDIR

	delete FS.virtual[localName];

	if(typeof Sys_notify !== 'undefined')
	{
		Sys_notify(false, localName);
	}
	return 0;
}

const FILED = {

	//setModuleInstance : setModuleInstance,
	fputs: fd_fputs,

	environ_sizes_get: environ_sizes_get,
	args_sizes_get: args_sizes_get,
	fd_fdstat_set_flags: function () { debugger; },
	fd_prestat_get: fd_prestat_get,
	fd_fdstat_get: fd_fdstat_get,
	fd_write: fd_write,
	fd_prestat_dir_name: fd_prestat_dir_name,
	environ_get: environ_get,
	args_get: args_get,
	fd_advise: function () { debugger; },
	fd_allocate: function () { debugger; },
	fd_datasync: function () { debugger; },
	path_open: path_openNew,
	fd_fdstat_set_rights: function () { debugger; },
	fd_filestat_set_size: function () { debugger; },
	fd_filestat_set_times: function () { debugger; },
	fd_pread: fd_pread,
	fd_seek: fd_seek,
	fd_read: fd_read,
	fd_close: _fd_close,
	fd_pwrite: function () { debugger; },
	fd_readdir: fd_readdir,
	fd_renumber: fd_renumber,
	fd_sync: function () { debugger; },
	fd_tell: function () { debugger; },
	path_filestat_get: path_filestat_getNew,
	path_filestat_set_times: function () { debugger; },
	path_link: function () { debugger; },
	path_readlink: path_readlink,
	path_symlink: path_symlink,
	path_unlink_file: path_unlink_fileNew,
	proc_raise: function () { debugger; },
	sched_yield: function () { debugger; },
	random_get: random_get,
	sock_recv: function () { debugger; },
	sock_send: function () { debugger; },
	sock_shutdown: function () { debugger; },
	AddDirectoryNode: AddDirectoryNode,
	AddFileNode: AddFileNode,
	FindNode: function FindNode() { debugger; },
	GetFileNodeAddress: function GetFileNodeAddress() { debugger; },
	GetFileNodeSize: function GetFileNodeSize() { debugger; },
	GetPathBuf: function GetPathBuf() { debugger; },
	GetPathBufLen: function GetPathBufLen() { debugger; },
	fd_allocate: function fd_allocate() { debugger; },
	fd_fdstat_set_flags: function fd_fdstat_set_flags() { debugger; },
	fd_filestat_get: fd_filestat_get,
	fd_filestat_set_size: function fd_filestat_set_size() { debugger; },
	init: function init() { debugger; },
	path_create_directory: path_create_directory,
	path_remove_directory: path_remove_directory,
	path_rename: path_rename,
	clock_time_get: clock_gettime,
	poll_oneoff: poll_oneoff,
	proc_exit: proc_exit,
	getpid: getpid,
	callsys: callsys,
	//getStringsFromArgv: getStringsFromArgv
};


/**
 * WASI fd_seek(fd, offset_low, offset_high, whence, new_offset_ptr)
 * Clang/WASI usually passes the i64 offset as two 32-bit ints or a BigInt
 */
function fd_seek(fd, offset, whence, newOffsetPtr)
{

	let stream = FS.pointers[fd];
	if(!stream) return 8; // WASI_EBADF
	if(!stream[2])
	{
		debugger;

	}
	if(stream[2].rewrite && stream[2].rewrite.length > 0)
	{
		stream = FS.pointers[stream[2].rewrite[stream[2].rewrite.length - 1]];
	}
	//console.log(stream[3])

	// 1. Force everything to BigInt for consistent 64-bit math
	let bigOffset = BigInt(offset);
	let currentPos = BigInt(stream[0]);
	let fileSize = BigInt(stream[2].contents.length);

	let newPos;

	switch(whence)
	{
		case 0: // SET
			newPos = bigOffset;
			break;
		case 1: // CUR
			newPos = currentPos + bigOffset;
			break;
		case 2: // END
			newPos = fileSize + bigOffset;
			break;
		default:
			return 28; // WASI_EINVAL
	}

	if(newPos < 0n) return 28; // WASI_EINVAL (can't seek before start)

	// 2. Update the internal pointer (back to Number if your FS expects it)
	stream[0] = Number(newPos);

	// 3. Write the result back to memory (64-bit)
	const view = new DataView(Module.memory.buffer);
	view.setUint32(newOffsetPtr, Number(newPos & 0xFFFFFFFFn), true);
	view.setUint32(newOffsetPtr + 4, Number(newPos >> 32n), true);

	return 0; // WASI_ESUCCESS
}

const virtual = {
	'/': {
		timestamp: new Date(),
		mode: FS_DIR,
		size: 4096,
		path: '/',
		parent: '',
		default: true
	},
	'.': {
		timestamp: new Date(),
		mode: FS_DIR,
		size: 4096,
		path: '.',
		parent: '',
		default: true
	},
	'/home': {
		timestamp: new Date(),
		mode: FS_DIR,
		size: 4096,
		path: '/home',
		parent: '/',
		default: true
	},
	'/tmp': {
		timestamp: new Date(),
		mode: FS_DIR, // ST_DIR + standard permissions
		size: 4096,
		path: '/tmp',
		parent: '/',
		default: true
	},
	'/dev/stdin': {
		timestamp: new Date(),
		mode: FS_FILE,
		size: 0,
		contents: new Uint8Array(),
		path: '/dev/stdin',
		parent: '/dev',
		default: true
	},
	'/dev/stdout': {
		timestamp: new Date(),
		mode: FS_FILE,
		size: 0,
		contents: new Uint8Array(),
		path: '/dev/stdout',
		parent: '/dev',
		default: true
	},
	'/dev/stderr': {
		timestamp: new Date(),
		mode: FS_FILE,
		size: 0,
		contents: new Uint8Array(),
		path: '/dev/stderr',
		parent: '/dev',
		default: true
	}
};

if((self || window).FS && typeof (self || window).FS.virtual !== 'undefined')
{
	Object.assign(virtual, (self || window).FS.virtual);
}

const FS = {
	ST_FILE: ST_FILE,
	ST_DIR: ST_DIR,
	FS_FILE: FS_FILE,
	FS_DIR: FS_DIR,
	ENOENT: ENOENT,
	modeToStr: ['r', 'w', 'rw'],
	filePointer: 3,
	virtual: virtual, // temporarily store items as they go in and out of memory
	pointers: [
		[0, 'r', virtual['/dev/stdin'], '/dev/stdin', 0, 0],
		[0, 'w', virtual['/dev/stdout'], '/dev/stdout', 1, 0],
		[0, 'w', virtual['/dev/stderr'], '/dev/stderr', 2, 0],
		[0, 'rw', virtual['/'], '/', 3, 0],
	],
};


Object.assign(FS, (self || window).FS);

if(typeof (self || window).FS === 'undefined')
{
	(self || window).FS = FS;
}



function getStreamChecked(fd)
{
	debugger;
	// 1. Check if the file descriptor is within a valid range
	// In your library, FS.pointers or a similar mapping tracks open files
	let stream = FS.pointers[fd];

	if(!stream)
	{
		// Return a standard POSIX EBADF (Bad File Descriptor) error
		// WASI_EBADF is usually 8
		throw new Error('ENOENT');
	}

	return stream;
};

const WASI_ESUCCESS = 0;
const WASI_EBADF = 8;
const WASI_EINVAL = 28;
const WASI_ENOSYS = 52;

const WASI_STDOUT_FILENO = 1;
const WASI_STDERR_FILENO = 2;

function fd_prestat_get(fd, bufPtr)
{
	// 1. Scoped result and early exit for invalid FDs
	if(fd !== VFS_NOW)
	{
		return 8; // WASI_EBADF (tells the guest to stop looking for drives)
	}

	const view = new DataView(Module.memory.buffer);

	// Offset 0: pr_type (0 = prestat_dir)
	view.setUint8(bufPtr, 0);

	// Offset 4: pr_name_len
	// We use 0 for the root mapping to match MemFs behavior
	view.setUint32(bufPtr + 4, 0, true);

	return 0; // WASI_ESUCCESS
}

function fd_prestat_dir_name(fd, pathPtr, pathLen)
{
	if(fd !== VFS_NOW)
	{
		return 8; // WASI_EBADF
	}

	// 2. Compatible Root Logic
	// If pathLen is 0, we don't write anything, but we MUST return success (0)
	// if the guest provided a buffer (pathLen >= 1), we write the root '/'
	if(pathLen > 0)
	{
		const heap = new Uint8Array(Module.memory.buffer);
		heap[pathPtr] = 47; // ASCII for '/'
	}

	return 0; // WASI_ESUCCESS (Matches MemFs even for 0-length calls)
}

function fd_filestat_get(fd, bufPtr)
{


	let stream = FS.pointers[fd];
	debugger;

	if(!stream) return 8; // WASI_EBADF
	if(stream[2].rewrite)
	{
		stream = FS.pointers[stream[2].rewrite];
	}

	//console.log(stream[3])

	const view = new DataView(Module.memory.buffer);

	// Clear 64 bytes
	for(let i = 0; i < 64; i++) view.setUint8(bufPtr + i, 0);

	// 1. Resolve Metadata from your FS.virtual layout
	// stream[2] appears to be your 'node' containing the mode/size
	const node = stream[2] || { mode: FS_FILE, contents: new Uint8Array(0) };
	const modeType = node.mode >> 12;

	// Map your ST_DIR/ST_FILE to WASI types
	let type = 8; // regular_file
	if(fd <= 3)
	{
		type = (fd === 3) ? 4 : 3; // 4=dir, 3=char_device
	} else if(modeType === ST_DIR)
	{
		type = 4;
	}

	// 2. Populate the Buffer
	// Device and Inode (using 1 as placeholders)
	view.setUint32(bufPtr + 0, 1, true);
	view.setUint32(bufPtr + 8, fd, true); // Using FD as inode for simplicity

	// Filetype (Offset 16)
	view.setUint8(bufPtr + 16, type);

	// nlink (Offset 24)
	view.setUint32(bufPtr + 24, 1, true);

	// Size (Offset 32) - 64-bit
	const size = node.contents.length || 0;
	view.setUint32(bufPtr + 32, size, true);
	view.setUint32(bufPtr + 36, 0, true);

	// Timestamps (Offset 40, 48, 56)
	// WASI expects nanoseconds. Convert JS ms to ns.
	const nowNsLow = (Date.now() * 1000000) >>> 0;
	const nowNsHigh = Math.floor((Date.now() * 1000000) / 0x100000000);

	for(let offset of [40, 48, 56])
	{
		view.setUint32(bufPtr + offset, nowNsLow, true);
		view.setUint32(bufPtr + offset + 4, nowNsHigh, true);
	}

	return 0; // WASI_ESUCCESS
}

function environ_sizes_get(environ_count_out, environ_buf_size_out)
{
	const view = new DataView(Module.memory.buffer); // or Module.memory.buffer
	const names = Object.getOwnPropertyNames(Module.environment);

	let size = 0;
	for(const name of names)
	{
		const value = Module.environment[name];
		// "name=value\0"
		size += name.length + value.length + 2;
	}

	// WASI standard usually expects 32-bit for these counts/sizes
	view.setUint32(environ_count_out, names.length, true);
	view.setUint32(environ_buf_size_out, size, true);

	return WASI_ESUCCESS;
}

function environ_get(environ_ptrs, environ_buf)
{
	const view = new DataView(Module.memory.buffer);
	const uint8 = new Uint8Array(Module.memory.buffer);
	const encoder = new TextEncoder();
	const names = Object.getOwnPropertyNames(Module.environment);

	let currentPtr = environ_ptrs;
	let currentBuf = environ_buf;

	for(const name of names)
	{
		// 1. Write the current buffer address to the pointer array
		view.setUint32(currentPtr, currentBuf, true);
		currentPtr += 4;

		// 2. Encode and write "name=value\0" into the buffer
		const str = `${name}=${Module.environment[name]}\0`;
		const encoded = encoder.encode(str);
		uint8.set(encoded, currentBuf);

		// 3. Advance buffer pointer by the actual byte length
		currentBuf += encoded.length;
	}

	// Null terminate the pointer array (optional but standard in some envs)
	// view.setUint32(currentPtr, 0, true);

	return WASI_ESUCCESS;
}

function args_sizes_get(argcPtr, argvBufSizePtr)
{
	const args = SYS.startArgs || [];
	const view = new DataView(Module.memory.buffer);

	view.setUint32(argcPtr, args.length, true);

	const encoder = new TextEncoder();
	const totalLength = args.reduce((acc, str) => acc + encoder.encode(str).length + 1, 0);
	view.setUint32(argvBufSizePtr, totalLength, true);

	return 0; // WASI_ESUCCESS
}

function args_get(argvPtr, argvBufPtr)
{
	const args = SYS.startArgs || [];
	let currentBufPtr = argvBufPtr;
	const encoder = new TextEncoder();

	const buffer = Module.memory.buffer;
	const view = new DataView(buffer);
	const heap = new Uint8Array(buffer); // FIXED: Uint8Array prevents sign-extension bugs

	args.forEach((arg, i) =>
	{
		// 1. Write the pointer to the array offset
		view.setUint32(argvPtr + (i * 4), currentBufPtr, true);

		// 2. Encode and safely copy unsigned bytes
		const bytes = encoder.encode(arg);
		heap.set(bytes, currentBufPtr);

		// 3. Write clean explicit null terminator
		heap[currentBufPtr + bytes.length] = 0;

		currentBufPtr += bytes.length + 1;
	});

	return 0; // WASI_ESUCCESS
}

function debug_print_mem(view, ptr, length)
{

	//const view = new Uint8Array(Module.memory.buffer, ptr, length);
	let hex = "";
	for(let i = 0; i < length; i++)
	{
		if(i > view.length) break;
		hex += view[i].toString(16).padStart(2, '0') + " ";
		if((i + 1) % 8 === 0) hex += " | ";
	}
	console.log(`Memory at 0x${ptr.toString(16)} (${length} bytes):`);
	console.log(hex);
}



function fd_fdstat_get(fd, bufPtr)
{


	let stream = FS.pointers[fd];

	if(!stream) return 8; // WASI_EBADF
	if(stream[2].rewrite)
	{
		stream = FS.pointers[stream[2].rewrite];
	}

	//console.log(stream[3])

	const view = new DataView(Module.memory.buffer);

	// 1. Determine WASI Type
	let type = 8; // Default to ST_FILE (WASI Regular File)

	if(fd <= 3)
	{
		// Your log showed '3' for both fd 3 and lower streams
		type = VFS_NOW;
	} else if(stream && stream[2])
	{
		// Extract the type from your FS.virtual mode (high 4 bits)
		const modeType = stream[2].mode >> 12;
		if(modeType === ST_DIR)
		{
			type = 4; // Directory
		} else if(modeType === ST_FILE)
		{
			type = 8; // Regular File
		}
	}

	// 2. Clear buffer and set values
	// Using the exact mask from your 'Success' log: 0x1FFFFFFF
	const SUCCESS_MASK = 0x1FFFFFFF;

	for(let i = 0; i < 24; i++) view.setUint8(bufPtr + i, 0);

	// Offset 0: Type
	view.setUint8(bufPtr, type);

	// Offset 2: Flags (keeping at 0 per your log)
	view.setUint16(bufPtr + 2, 0, true);

	// Offset 8: Base Rights (Lower 32 bits)
	view.setUint32(bufPtr + 8, SUCCESS_MASK, true);

	// Offset 16: Inheriting Rights (Lower 32 bits)
	view.setUint32(bufPtr + 16, SUCCESS_MASK, true);

	return 0; // WASI_ESUCCESS
}


function fd_write(fd, iovs, iovsLen, nwritten)
{
	const view = new DataView(Module.memory.buffer);
	let written = 0;

	// START REDIRECTION INTERCEPTION
	let targetFd = fd;

	// If the binary is trying to write to standard stdout (1)...
	if(fd === 1 && Module.exports && Module.exports.out_fd)
	{
		try
		{
			// 1. Resolve the memory location of the out_fd pointer symbol
			const outFdSymbolPtr = Module.exports.out_fd.value || Module.exports.out_fd;

			// 2. Read the 32-bit address stored inside out_fd out of active WASM linear memory
			const actualFileStructureAddr = view.getUint32(outFdSymbolPtr, true);

			// 3. If out_fd has been changed from NULL/stdout to a real file node structure pointer,
			// grab the underlying file descriptor number mapped inside it!
			if(actualFileStructureAddr !== 0)
			{
				// In musl libc, the file descriptor integer is typically the first field in the struct
				const mappedFd = view.getUint32(actualFileStructureAddr, true);

				// If it successfully extracts a valid redirected file descriptor, swap the target track!
				if(mappedFd > 2 && mappedFd < 1024)
				{
					targetFd = mappedFd;
				}
			}
		} catch(err)
		{
			// Silent fallback to standard stdout if structure parsing encounters unaligned offsets
		}
	}
	// END REDIRECTION INTERCEPTION

	// 1. Get the stream/pointer object for this FD (Using targetFd instead of fd)
	let stream = FS.pointers[targetFd];
	if(!stream) return 8; // WASI_EBADF
	if(stream[2].rewrite)
	{
		stream = FS.pointers[stream[2].rewrite];
	}


	// 2. Collect all bytes from iovs into one Uint8Array
	// We do this first to calculate total 'written' size
	const iovsList = [];
	for(let i = 0; i < iovsLen; i++)
	{
		let ptr = iovs + i * 8;
		let buf = view.getUint32(ptr, true);
		let bufLen = view.getUint32(ptr + 4, true);
		iovsList.push(new Uint8Array(Module.memory.buffer, buf, bufLen));
		written += bufLen;
	}


	// 3. Handle Standard I/O (Using original fd to check for terminal console streaming limits)
	if(targetFd <= 2 && !FS.pointers[targetFd][2].rewrite)
	{
		// Concatenate for the host console/logs
		let totalBuf = new Uint8Array(written);
		let offset = 0;
		for(let b of iovsList)
		{
			totalBuf.set(b, offset);
			offset += b.byteLength;
		}

		if(typeof Module.hostWrite !== 'undefined')
		{
			const msg = String.fromCharCode.apply(null, totalBuf);
			Module.hostWrite(msg);
		}
		view.setUint32(nwritten, written, true);
		return 0;
	}


	// 4. Handle Actual File Write (fd > 2 or redirected targetFd > 2)
	// stream layout: [position, mode, node, path, fd]
	let pos = stream[0];
	const node = stream[2]; // This is the object in FS.virtual[path]

	if(!node) return 28; // WASI_EINVAL

	// Ensure node.contents is a Uint8Array
	if(!(node.contents instanceof Uint8Array))
	{
		node.contents = new Uint8Array(0);
	}

	// Expand buffer if writing beyond current capacity
	if(pos + written > node.contents.byteLength)
	{
		let newSize = pos + written;
		let newBuf = new Uint8Array(newSize);
		newBuf.set(node.contents);
		node.contents = newBuf;
	}

	// Copy each iov buffer into the node's contents at the current position
	let currentOffset = pos;
	for(let b of iovsList)
	{
		node.contents.set(b, currentOffset);
		currentOffset += b.byteLength;
	}

	// 5. Update the seek position for the next write
	stream[0] = currentOffset;

	// Write the number of bytes successfully written to nwritten pointer
	view.setUint32(nwritten, written, true);

	// Notify UI/Storage that the file has changed (Using targetFd to maintain the correct tracking index)
	if(typeof Sys_notify !== 'undefined')
	{
		if(FS.pointers[targetFd][2].rewrite)
		{
			Sys_notify(FS.pointers[FS.pointers[targetFd][2].rewrite][2], FS.pointers[FS.pointers[targetFd][2].rewrite][3], targetFd);
		}
		else
			Sys_notify(node, stream[3], targetFd);
	}

	return 0; // WASI_ESUCCESS
}

function poll_oneoff(in_ptr, out_ptr, nsubscriptions, nevents_out)
{
	this.mem.check();
	const mem = new DataView(Module.memory.buffer);
	let eventsCreated = 0;

	for(let i = 0; i < nsubscriptions; i++)
	{
		// WASI Subscription struct is 40 bytes
		const subPtr = in_ptr + (i * 40);
		const userdata = mem.getBigUint64(subPtr, true);
		const type = mem.getUint8(subPtr + 8); // 0 = Clock, 1 = FD_READ, 2 = FD_WRITE

		if(type === 0)
		{ // EVENTTYPE_CLOCK
			// Clock subscription starts at offset 16
			const clockId = mem.getUint32(subPtr + 16, true);
			const timeout = mem.getBigUint64(subPtr + 24, true);
			const precision = mem.getBigUint64(subPtr + 32, true);
			const flags = mem.getUint16(subPtr + 40, true);

			// In a browser, we can't actually "sleep" synchronously
			// without blocking the UI thread, so we just report success
			// immediately or check if the timeout is valid.

			// Write the Event back to out_ptr (32 bytes)
			const eventPtr = out_ptr + (eventsCreated * 32);
			mem.setBigUint64(eventPtr, userdata, true); // Userdata
			mem.setUint16(eventPtr + 8, 0, true);       // error (0 = Success)
			mem.setUint8(eventPtr + 10, 0);             // type (Clock)

			eventsCreated++;
		} else
		{
			// For FD_READ/WRITE, we usually just report success for standard streams
			const eventPtr = out_ptr + (eventsCreated * 32);
			mem.setBigUint64(eventPtr, userdata, true);
			mem.setUint16(eventPtr + 8, 0, true);
			mem.setUint8(eventPtr + 10, type);
			eventsCreated++;
		}
	}

	// Write number of events created to the output pointer
	const outEventsView = new Uint32Array(this.mem.buffer, nevents_out, 1);
	outEventsView[0] = eventsCreated;

	return 0; // errno.SUCCESS
}


function proc_exit(rval)
{
	if(typeof GL == 'undefined')
	{
		let error = new Error('WASI_ENOSYS');
		error.code = rval;
		throw error;
	}
	return WASI_ENOSYS;
}


function path_open(dirfd, lookupflags, pathPtr, pathLen, oflags, rights_base, rights_inheriting, fdflags, openedFdPtr)
{

	if(dirfd === 0)
	{
		debugger;
	}
	// 1. Resolve Memory Buffer (Host vs Inner Module)
	const buffer = Module.memory.buffer;

	const path = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// 2. Resolve Full Path relative to dirfd
	let localName = path.trim();
	//console.log(localName)
	if(!localName.startsWith('/')) localName = '/' + localName;
	if(!localName.startsWith('/base')) localName = '/base' + localName;
	if(localName.endsWith('/.')) localName = localName.substring(0, localName.length - 2);
	if(localName.startsWith('../lib/')) localName = 'lib/' + localName.substring(7);

	// 3. Handle oflags (WASI specific)
	const O_CREAT = 1;
	const O_DIRECTORY = 2;
	const O_EXCL = 4;
	const O_TRUNC = 8;

	const exists = typeof FS.virtual[localName] !== 'undefined'
		&& FS.virtual[localName] !== null;

	if(!exists)
	{
		if(oflags & O_CREAT
			&& !FS.virtual[localName]
		)
		{
			// Create a new virtual node
			FS.virtual[localName] = {
				contents: new Uint8Array(0),
				timestamp: new Date(),
				mode: (oflags & O_DIRECTORY) ? FS_DIR : FS_FILE,
				size: 0,
				path: localName,
				parent: localName.substring(0, localName.lastIndexOf('/'))
			};
		}

		// TODO: memfs passthrough?
		else
		{
			return 44; // WASI_ENOENT
		}
	} else
	{
		if((oflags & O_CREAT) && (oflags & O_EXCL)) return 20; // WASI_EEXIST
		if(oflags & O_TRUNC)
		{
			//debugger
			FS.virtual[localName].contents = new Uint8Array(0);
			//FS.virtual[localName].size = 0;
		}
	}

	const rb = BigInt(rights_base);
	const canRead = (rb & 2n) !== 0n;
	const canWrite = (rb & 64n) !== 0n;
	const modeStr = (canRead ? 'r' : '') + (canWrite ? 'w' : '');
	const view = new DataView(Module.memory.buffer); // Result ALWAYS goes to host memory

	if(false && api.memfs)
	{

		let result = api.memfs.exports.path_open(dirfd, lookupflags, pathPtr, pathLen, oflags, rights_base, rights_inheriting, fdflags, openedFdPtr);
		if(result === 0)
		{

			let localPointer = FS.filePointer = view.getUint32(openedFdPtr, true);
			debugger;
			FS.pointers[localPointer] = [
				0, // seek/tell
				modeStr,
				FS.virtual[localName],
				localName,
				localPointer,
				api?.pid || 42
			];
		}
		return result;
	}

	else
	{
		// Layout: [position, path, node]
		if(!FS.virtual[localName])
		{
			debugger;
		}
		let createFP = function ()
		{
			FS.filePointer++;
			debugger;
			FS.pointers[FS.filePointer] = [
				0, // seek/tell
				modeStr,
				FS.virtual[localName],
				localName,
				FS.filePointer,
				api?.pid || 42
			];
			//if (!FS.pointers[0][2].rewrite)
			//	FS.pointers[0][2].rewrite = FS.filePointer
			//else
			//	debugger
			//if (!(oflags & O_TRUNC))
			//	Sys_notify(FS.virtual[localName], localName)
			return FS.filePointer; // not zero
		};

		// 5. Write result to guest memory
		view.setUint32(openedFdPtr, createFP(), true);

	}

	return 0; // WASI_ESUCCESS
}



function _fd_close(fd)
{
	try
	{
		//if (fd === 0) debugger
		//if(fd < 4) debugger
		debugger;
		if(fd < 4)
		{
			if(!FS.pointers[fd])
			{
				//debugger
				return 0;
			}
			FS.pointers[fd][0] = 0;
			FS.pointers[fd][2].contents = new Uint8Array(0);
			return 0;
		}
		if(FS.pointers[fd] && FS.pointers[fd][2].rewrite)
			debugger;
		if(!FS.pointers[fd]) return 8; // WASI_EBADF
		//let stream = SYSCALLS.getStreamFromFD(fd);
		if(fd <= VFS_NOW)
		{
			FS.pointers[fd][2].contents = new Uint8Array(0);
			FS.pointers[fd][2].rewrite = 0;
			return;
		}
		if(FS.pointers[fd] && FS.pointers[fd][2].rewrite)
		{
			debugger;
			FS.pointers[FS.pointers[fd][2].rewrite] = null;
			FS.pointers[fd][2].rewrite = 0;
		}
		else
			FS.pointers[fd] = null;
		return 0;
	} catch(e)
	{
		if(typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
		return e.errno;
	}
}

const ST_UNSTABLE_DIR = 3;
const ST_UNSTABLE_FILE = 4;
const ST_UNSTABLE_LINK = 7;

function path_filestat_get(dirfd, lookupflags, pathPtr, pathLen, bufPtr)
{

	const buffer = Module.memory.buffer;
	const path = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// 1. Normalize Path - MUST MATCH YOUR path_open LOGIC EXACTLY
	let localName = path;
	//console.log(localName)
	if(!localName.startsWith('/')) localName = '/' + localName;
	if(!localName.startsWith('/base')) localName = '/base' + localName;
	if(localName.startsWith('../lib/')) localName = 'lib/' + localName.substring(7);
	if(localName.startsWith('/')) localName = localName.substring(1);

	const file = FS.virtual[localName];
	if(!file) return 44; // ENOENT

	const view = new DataView(buffer);
	new Uint8Array(buffer, bufPtr, 64).fill(0);

	// dev (0)
	view.setBigUint64(bufPtr + 0, BigInt(dirfd), true);

	// ino (8) - Use small stable IDs to avoid 32-bit guest overflows
	let myNode = Object.values(FS.pointers).find(p => p && p[3] == localName);
	if(!myNode)
	{
		/*
		FS.filePointer++
		FS.pointers[FS.filePointer] = [
			0, // seek/tell
			'rw',
			FS.virtual[localName],
			localName,
			FS.filePointer
		]
		myNode = FS.filePointer
		*/
	}
	else
	{
		if(myNode[2].rewrite)
			myNode = myNode[2].rewrite;
		else
			myNode = myNode[4];
		view.setBigUint64(bufPtr + 8, BigInt(myNode), true);
	}

	// type (16)
	const isDir = (file.mode >> 12) === 4;
	view.setUint8(bufPtr + 16, isDir ? ST_UNSTABLE_DIR : ST_UNSTABLE_FILE);

	// nlink (20) - 32-bit!
	view.setUint32(bufPtr + 20, 1, true);

	// size (24) - Starts at 24 in unstable
	const size = isDir ? 0n : BigInt(file.contents?.length || 0);
	view.setBigUint64(bufPtr + 24, size, true);

	// timestamps (32, 40, 48)
	const timeNs = BigInt(file.timestamp.getTime()) * 1000000n;
	view.setBigUint64(bufPtr + 32, timeNs, true); // atime
	view.setBigUint64(bufPtr + 40, timeNs, true); // mtime
	view.setBigUint64(bufPtr + 48, timeNs, true); // ctime

	return 0;

}

// Helper to safely write a 32-bit value to a potentially BigInt pointer
function writeU32(ptr, value)
{
	const addr = Number(ptr); // Force BigInt pointer to Number
	const view = new DataView(Module.memory.buffer);
	view.setUint32(addr, value, true);
	return 0;
}

function fd_read(fd, iovs, iovsLen, nreadPtr)
{
	let stream = FS.pointers[fd];
	if(!stream) return 8; // WASI_EBADF

	if(stream[2] && stream[2].rewrite)
	{
		stream = FS.pointers[stream[2].rewrite];
	}

	if(typeof Module.HEAPU8 === 'undefined' || Module.HEAPU8.byteLength === 0)
	{
		updateGlobalBufferAndViews();
	}

	const view = new DataView(Module.memory.buffer);
	const contents = stream[2].contents; // Uint8Array of file data

	if(!contents) return 22; // WASI_EINVAL (File has no content payload)

	let totalRead = 0;

	for(let i = 0; i < iovsLen; i++)
	{
		const iovPtr = iovs + (i * 8);
		const bufOffset = view.getUint32(iovPtr, true);
		const bufLen = view.getUint32(iovPtr + 4, true);

		// ALWAYS read current offset directly from the source array reference
		let currentOffset = stream[0];
		const available = contents.length - currentOffset;
		const toRead = Math.min(bufLen, available);

		if(toRead > 0)
		{
			const heap = new Uint8Array(Module.memory.buffer);
			heap.set(contents.subarray(currentOffset, currentOffset + toRead), bufOffset);

			// Mutate the reference element immediately so the next loop index gets it
			stream[0] += toRead;
			totalRead += toRead;
		}

		// If this vector consumed the rest of the file, we can exit cleanly
		if(stream[0] >= contents.length)
		{
			break;
		}
	}

	const finalView = new DataView(Module.memory.buffer);
	finalView.setUint32(nreadPtr, totalRead, true);
	return 0; // WASI_ESUCCESS
}

/**
 * WASI fd_pread Implementation
 * Handles the 64-bit BigInt offset parameter positioning.
 */
function fd_pread(fd, iovs, iovsLen, offsetBigInt, nreadPtr)
{
	debugger;
	let stream = FS.pointers[Number(fd)];
	if(!stream) return 8; // WASI_EBADF
	if(stream[2].rewrite)
	{
		stream = FS.pointers[stream[2].rewrite];
	}

	// Safely cast the 64-bit BigInt offset down to a standard JS safe integer index
	const baseOffset = Number(offsetBigInt);
	const node = stream[2];
	const contents = node.contents; // Uint8Array
	let totalRead = 0;

	if(typeof Module.HEAPU8 === 'undefined' || Module.HEAPU8.byteLength === 0)
	{
		updateGlobalBufferAndViews();
	}
	const view = new DataView(Module.memory.buffer);
	const iovs_ptr = Number(iovs);

	for(let i = 0; i < Number(iovsLen); i++)
	{
		const iovAddr = iovs_ptr + (i * 8);
		const bufAddr = view.getUint32(iovAddr, true);
		const bufLen = view.getUint32(iovAddr + 4, true);

		const available = contents.length - (baseOffset + totalRead);
		const toRead = Math.min(bufLen, available);

		if(toRead > 0)
		{
			// Fix: Instantiate directly via the underlying buffer using exact offsets
			const heap = new Uint8Array(Module.memory.buffer);
			heap.set(contents.subarray(baseOffset + totalRead, baseOffset + totalRead + toRead), bufAddr);
			totalRead += toRead;
		}
		if(toRead < bufLen) break;
	}

	// Refresh memory view reference layer for the final size flag registration
	const finalView = new DataView(Module.memory.buffer);
	finalView.setUint32(nreadPtr, totalRead, true);
	return 0; // WASI_ESUCCESS
}


function fd_readdir(fd, buf, buf_len, cookie, nread_ptr)
{
	debugger;
	const view = new DataView(Module.memory.buffer);
	const heap = new Uint8Array(Module.memory.buffer);

	// 1. Validate descriptor stream existence
	let stream = FS.pointers[fd];
	if(!stream) return 8; // WASI_EBADF
	if(stream[2].rewrite)
	{
		stream = FS.pointers[stream[2].rewrite];
	}

	const dirNode = stream[2];
	const dirPath = stream[3]; // e.g. "code/game" or "" for root

	// 2. Filter FS.virtual keys to find immediate children matching this directory
	const prefix = dirPath === "" || dirPath === "/" ? "" : (dirPath.endsWith('/') ? dirPath : dirPath + '/');
	const entries = Object.keys(FS.virtual).filter(key =>
	{
		if(prefix === "")
		{
			// Root items shouldn't contain forward slashes unless it's deep nesting
			return !key.includes('/');
		}
		if(!key.startsWith(prefix) || key === prefix) return false;

		// Ensure we are only pulling immediate children (no deep recursion)
		const relativePart = key.substring(prefix.length);
		return !relativePart.includes('/');
	});

	let currentCookie = Number(cookie);
	let bytesWritten = 0;

	// 3. Serialize entries starting from the requested cookie index
	while(currentCookie < entries.length)
	{
		const name = entries[currentCookie];
		const node = FS.virtual[name];

		// Encode entry name string to UTF-8 array
		const encoder = new TextEncoder();
		const nameBytes = encoder.encode(name);

		// WASI dirent size = 24 bytes header + name length
		const entrySize = 24 + nameBytes.length;

		// Stop if adding this directory entry would overflow the guest target memory buffer
		if(bytesWritten + entrySize > buf_len)
		{
			break;
		}

		const currentBufPtr = buf + bytesWritten;
		const nextCookieValue = BigInt(currentCookie + 1);
		const inodeValue = BigInt(fd); // Fallback stable pointer indicator

		// Determine WASI file type (4 = directory, 8 = regular file)
		const type = ((node.mode >> 12) === 4) ? 4 : 8;

		// Write 24-byte WASI dirent layout header structure
		view.setBigUint64(currentBufPtr + 0, nextCookieValue, true);          // d_next (cookie for NEXT element)
		view.setBigUint64(currentBufPtr + 8, inodeValue, true);               // d_ino
		view.setUint32(currentBufPtr + 16, nameBytes.length, true);           // d_namlen
		view.setUint8(currentBufPtr + 20, type);                              // d_type

		// Clear 3 padding bytes (offsets 21, 22, 23)
		view.setUint16(currentBufPtr + 21, 0, true);
		view.setUint8(currentBufPtr + 23, 0);

		// Copy raw name token bytes directly behind header block layout
		heap.set(nameBytes, currentBufPtr + 24);

		bytesWritten += entrySize;
		currentCookie++;
	}

	// Write final output metrics back to the requested registration pointer
	view.setUint32(nread_ptr, bytesWritten, true);
	return 0; // WASI_ESUCCESS
}

function random_get(buf, buf_len)
{
	const data = new Uint8Array(Module.memory.buffer, buf, buf_len);
	for(let i = 0; i < buf_len; ++i)
	{
		data[i] = (Math.random() * 256) | 0;
	}
	return 0; // WASI_ESUCCESS (Explicitly notify the guest stack environment of success)
}

function path_readlink(dirfd, pathPtr, pathLen, bufPtr, bufLen, nreadPtr)
{
	const buffer = Module.memory.buffer;
	const path = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	debugger;
	// 1. Normalize path
	let localName = path;
	if(!localName.startsWith('/')) localName = '/' + localName;
	if(!localName.startsWith('/base')) localName = '/base' + localName;

	const file = FS.virtual[localName];

	// 2. Check if file exists and is a symlink
	// WASI filetype for symbolic_link is 7
	// If you don't support symlinks, return EINVAL (28)
	if(!file)
	{
		return 44; // ENOENT
	}

	// If your FS doesn't store a 'target' property, it's not a link
	if(!file.target)
	{
		return 28; // EINVAL (Not a symbolic link)
	}

	// 3. Handle the buffer copy
	const encoder = new TextEncoder();
	const targetBytes = encoder.encode(file.target);
	const len = Math.min(targetBytes.length, bufLen);

	const heap = new Uint8Array(buffer);
	heap.set(targetBytes.subarray(0, len), bufPtr);

	// 4. Write the number of bytes read back to guest memory
	const view = new DataView(buffer);
	view.setUint32(nreadPtr, len, true);

	return 0; // WASI_ESUCCESS
}
/**
 * fd_renumber(fd, to)
 * Maps to POSIX dup2(fd, to) logic.
 */
function fd_renumber(fd, to)
{


	if(to === 0)
	{
		//debugger
	}


	debugger;
	// 1. Validate the source descriptor
	let stream = FS.pointers[fd];

	if(!stream)
	{
		return 8; // WASI_EBADF
	}

	// 2. If 'to' is already open, POSIX says we silently close it first
	if(FS.pointers[to])
	{
		// You might want to call Sys_FClose(to) here to ensure
		// any pending Sys_notify calls fire.
		FS.pointers[to][0] = 0;
	}
	else
	{
		// 3. Renumber: Copy the reference to the new 'to' index
		if(!stream[2])
		{
			debugger;
		}
		FS.pointers[to] = [
			0, // seek/tell
			stream[1],
			stream[2],
			stream[3],
			fd
		];
	}

	// 4. Update the internal FD stored in your stream array [pos, mode, node, path, FD]
	// stream[4] is where you store the FD index
	FS.pointers[to][2].rewrite = fd;
	FS.pointers[to][4] = fd;

	// 5. Remove the old reference
	//FS.pointers[fd] = null;

	return 0; // WASI_ESUCCESS
}

function fd_fputs(s, f)
{
	let l = addressToString(s).length;
	return Sys_FWrite(s, 1, l, f) == l ? 0 : -1;
}

function path_symlink(oldPathPtr, oldPathLen, dirfd, newPathPtr, newPathLen)
{

	debugger;
	const buffer = Module.memory.buffer;

	const target = new TextDecoder().decode(new Uint8Array(buffer, oldPathPtr, oldPathLen));
	const linkName = new TextDecoder().decode(new Uint8Array(buffer, newPathPtr, newPathLen));

	// Resolve virtual path
	let localLink = linkName.startsWith('/') ? linkName.substring(1) : linkName;

	FS.virtual[localLink] = {
		contents: new TextEncoder().encode(target), // The 'data' of a symlink is the path it points to
		timestamp: new Date(),
		mode: (7 << 12) + FS_DEFAULT, // S_IFLNK (Symbolic Link)
		size: target.length,
		path: localLink,
		target: target, // Helper for your path resolution logic
		parent: localLink.substring(0, localLink.lastIndexOf('/')),
	};

	if(api.memfs)
	{
		debugger;
		return api.memfs.exports.path_symlink(oldPathPtr, oldPathLen, dirfd, newPathPtr, newPathLen);
	}

	return 0;
}

function AddDirectoryNode(parentFd, pathPtr, pathLen)
{
	const buffer = Module.memory.buffer;
	const name = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// Normalize path to prevent leading slash panics
	let localName = name;
	if(localName.startsWith('/')) localName = localName.substring(1);
	if(localName.endsWith('/')) localName = localName.substring(0, localName.length - 1);

	if(typeof FS.virtual[localName] === 'undefined')
	{
		FS.virtual[localName] = {
			contents: null, // Directories don't have binary contents
			timestamp: new Date(),
			mode: FS_DIR,
			size: 4096, // Standard directory block size
			path: localName,
			parent: localName.substring(0, localName.lastIndexOf('/'))
		};
	}

	if(api.memfs)
	{
		debugger;
		// Only call the WASM export if we know it's a safe creation
		// Note: We use the normalized length to match the buffer write
		return api.memfs.exports.AddDirectoryNode(parentFd, pathPtr, pathLen);
	}

	return 0;
}

function AddFileNode(parentFd, pathPtr, pathLen)
{
	const buffer = Module.memory.buffer;
	const name = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// Resolve path (Assuming root dirfd 3 for context if not specified)
	const localName = name.startsWith('/') ? name.substring(1) : name;

	// Check if it already exists to avoid the 'unreachable' panic
	if(typeof FS.virtual[localName] === 'undefined')
	{
		FS.virtual[localName] = {
			contents: new Uint8Array(0),
			timestamp: new Date(),
			mode: FS_FILE,
			size: 0,
			path: localName,
			parent: localName.substring(0, localName.lastIndexOf('/'))
		};
	}

	if(api.memfs)
	{
		debugger;
		// Sync with WASM backend
		return api.memfs.exports.AddFileNode(parentFd, pathPtr, pathLen);
	}

	return 0; // WASI_ESUCCESS
}


function getStringsFromArgv(argv)
{
	const u8 = new Uint8Array(Module.memory.buffer);
	const args = [];

	// If argv is a number, it's a pointer to a NULL-terminated array in WASM memory
	if(typeof argv === 'number')
	{
		const view = new DataView(Module.memory.buffer);
		for(let i = 0; ; i++)
		{
			const stringPointer = view.getUint32(argv + (i * 4), true);
			if(stringPointer === 0) break; // NULL terminator

			// Using your Mem lib's string reader (assuming it's called readString or similar)
			args.push(readStr(u8, stringPointer));
		}
	}
	// If argv is already an array (passed via ...argv in JS), just sanitize it
	else if(Array.isArray(argv))
	{
		return argv.map(arg => (typeof arg === 'number' ? readStr(u8, arg) : arg));
	}

	return args;
}

function callsys(argvPtr)
{
	const u8 = new Uint8Array(Module.memory.buffer);
	const cmdArgs = getStringsFromArgv(argvPtr);
	const targetKey = cmdArgs[0];
	try
	{

		// Await the execution of the WASM tool
		let result = api.runSync(targetKey, ...cmdArgs);
		console.log('Process resulted in: ' + result);

		return result;
	} catch(e)
	{
		console.log(`Execution failed for ${cmdArgs}: ${e.message}\n\r${e.stack || e.stacktrace}`);
		return 100; // Standard error exit for LCC
	}
}


// Global tracking state for our simulated single-threaded process table
let virtualChildExitCode = 0;
let forkToggle = false;

function getpid()
{
	return api?.pid || 42;
}

function readStr(u8, o, len = -1)
{
	let str = '';
	let end = u8.length;
	if(len != -1)
		end = o + len;
	for(let i = o; i < end && u8[i] != 0; ++i)
		str += String.fromCharCode(u8[i]);
	return str;
}

function path_unlink_file(dirfd, pathPtr, pathLen)
{
	const buffer = Module.memory.buffer;
	const path = new TextDecoder().decode(new Uint8Array(buffer, pathPtr, pathLen));

	// 1. Normalize Path - Use the EXACT logic from filestat
	let localName = path;
	if(!localName.startsWith('/')) localName = '/' + localName;
	if(!localName.startsWith('/base')) localName = '/base' + localName;
	if(localName.endsWith('/.')) localName = localName.substring(0, localName.length - 2);
	if(localName.startsWith('../lib/')) localName = 'lib/' + localName.substring(7);

	const file = FS.virtual[localName];

	// 2. Check existence
	if(!file)
	{
		return 44; // WASI_ENOENT
	}

	debugger;
	// 3. Check type
	// In WASI, path_unlink_file is strictly for files.
	// If it's a directory, return EPERM (1) or EISDIR (31)
	const isDir = (file.mode >> 12) === 4; // Your ST_DIR check
	if(isDir)
	{
		return 31; // WASI_EISDIR
	}

	// 4. Perform Deletion
	delete FS.virtual[localName];

	// 5. Cleanup active pointers (Optional but recommended)
	// If a file is open and unlinked, POSIX says it stays until closed,
	// but for your bare-bones VFS, just making it unreachable is usually fine.

	// 6. Notify Sync/UI
	if(typeof Sys_notify !== 'undefined')
	{
		Sys_notify(false, localName);
	}

	return 0; // WASI_ESUCCESS
}



function path_rename(oldFd, oldPathPtr, oldPathLen, newFd, newPathPtr, newPathLen)
{

	const heap = new Uint8Array(Module.memory.buffer);

	debugger;

	// 1. Read the paths
	// In your log, oldPathPtr was actually 6635560 (the 2nd argument)
	let oldPath = readStr(heap, oldPathPtr, oldPathLen);
	let newPath = readStr(heap, newPathPtr, newPathLen);

	/*
	// 2. Resolve them against their respective FDs
	// Since fd 3 is your root "/", we just join them.
	const resolve = (fd, path) => {
		let base = (fd === 3) ? "/" : (FS.pointers[fd] ? FS.pointers[fd][1] : "/");
		let full = base + (base.endsWith('/') ? '' : '/') + path;
		// Clean up double slashes and relative dots if necessary
		return full.replace(/\/+/g, '/');
	};

	const oldPath = resolve(oldFd, oldPathRelative);
	const newPath = resolve(newFd, newPathRelative);
	*/

	// 3. The Actual Rename Logic (Flat Key Swap)
	if(typeof FS.virtual[oldPath] === 'undefined') return 44; // ENOENT

	const node = FS.virtual[oldPath];
	const isDir = (node.mode >> 12) === 4;

	if(isDir)
	{
		const oldPrefix = oldPath.endsWith('/') ? oldPath : oldPath + '/';
		const newPrefix = newPath.endsWith('/') ? newPath : newPath + '/';

		Object.keys(FS.virtual).forEach(p =>
		{
			if(p.startsWith(oldPrefix))
			{
				const updated = newPrefix + p.substring(oldPrefix.length);
				FS.virtual[updated] = FS.virtual[p];
				FS.virtual[updated].parent = updated.substring(0, updated.lastIndexOf('/'));
				delete FS.virtual[p];
			}
		});
	}

	FS.virtual[newPath] = node;
	FS.virtual[newPath].parent = newPath.substring(0, newPath.lastIndexOf('/'));
	delete FS.virtual[oldPath];

	return 0; // SUCCESS
}


/**
 * WASI path_create_directory implementation
 * @param {number} fd - Base file descriptor (e.g., 3 for root preopen)
 * @param {number} pathPtr - Linear memory address of the directory name string
 * @param {number} pathLen - Explicit byte length of the directory name string
 * @returns {number} WASI errno (0 = Success, 76 = ENOTDIR, 20 = EEXIST, etc.)
 */
function path_create_directory(fd, pathPtr, pathLen)
{
	// 1. Ensure the global views are active and valid
	if(typeof Module.HEAPU8 === 'undefined' || Module.HEAPU8.byteLength === 0)
	{
		updateGlobalBufferAndViews();
	}
	const heap = Module.HEAPU8 || window.HEAPU8;

	// 2. WASI Optimization: Decode using the exact length provided by the engine
	const folderBytes = heap.subarray(pathPtr, pathPtr + pathLen);
	const dirPath = new TextDecoder("utf-8").decode(folderBytes);
	const normalizedPath = dirPath.replace(/\/$/, "");

	if(!FS.virtual) FS.virtual = {};

	// 3. POSIX/WASI Check: Check if path already exists
	if(FS.virtual[normalizedPath])
	{
		const isDir = (FS.virtual[normalizedPath].mode >> 12) === 4; // S_IFDIR check (or use your ST_DIR)
		if(!isDir)
		{
			console.error(`WASI VFS Error: Path exists and is a file -> ${normalizedPath}`);
			return 20; // WASI_EEXIST (File exists)
		}
		return 0; // Success, directory is already accessible
	}

	// 4. Inject the compliant WASI directory entry
	FS.virtual[normalizedPath] = {
		path: normalizedPath,
		parent: normalizedPath.substring(0, normalizedPath.lastIndexOf('/')),
		sha: "virtual_dir_sha",
		type: 'dir',
		mode: 0o040000 | 0o755, // S_IFDIR | permissions (755)
		size: 4096,
		timestamp: new Date()
	};

	console.log(`WASI VFS: Created directory via fd(${fd}) -> "${normalizedPath}"`);
	return 0; // WASI_ESUCCESS
}

/**
 * WASI path_remove_directory implementation
 * @param {number} fd - Base file descriptor
 * @param {number} pathPtr - Linear memory address
 * @param {number} pathLen - String byte length
 */
function path_remove_directory(fd, pathPtr, pathLen)
{
	if(typeof Module.HEAPU8 === 'undefined' || Module.HEAPU8.byteLength === 0)
	{
		updateGlobalBufferAndViews();
	}
	const heap = Module.HEAPU8 || window.HEAPU8;

	const folderBytes = heap.subarray(pathPtr, pathPtr + pathLen);
	const dirPath = new TextDecoder("utf-8").decode(folderBytes);
	const normalizedPath = dirPath.replace(/\/$/, "");

	if(!FS.virtual || !FS.virtual[normalizedPath])
	{
		console.warn(`WASI VFS Error: Directory not found -> ${normalizedPath}`);
		return 44; // WASI_ENOENT (No such file or directory)
	}

	if(FS.virtual[normalizedPath].type !== 'dir')
	{
		console.error(`WASI VFS Error: Path is not a directory -> ${normalizedPath}`);
		return 76; // WASI_ENOTDIR (Not a directory)
	}

	// Check if empty
	const prefix = normalizedPath + "/";
	const isNotEmpty = Object.keys(FS.virtual).some(filePath => filePath.startsWith(prefix));

	if(isNotEmpty)
	{
		console.error(`WASI VFS Error: Directory not empty -> ${normalizedPath}`);
		return 54; // WASI_ENOTEMPTY (Directory not empty)
	}

	delete FS.virtual[normalizedPath];
	console.log(`WASI VFS: Removed directory via fd(${fd}) -> "${normalizedPath}"`);
	return 0; // WASI_ESUCCESS
}


function clock_gettime(clk_id, precision, tp)
{
	// If the engine passes 3 args, 'tp' is the third argument slot (index 2)
	// If an older tool pass only sent 2 args, fallback gracefully to the second slot
	const tpAddr = arguments.length === 3 ? Number(tp) : Number(precision);
	const id = Number(clk_id);

	let now;
	if(id === 0)
	{ // CLOCK_REALTIME
		now = Date.now(); // Milliseconds since epoch
	} else
	{ // CLOCK_MONOTONIC / CLOCK_THREAD_CPUTIME_ID etc.
		now = performance.now();
	}

	// WASI standard: timestamp must be written as total nanoseconds since epoch/boot
	// 1 millisecond = 1,000,000 nanoseconds
	const totalNanoseconds = BigInt(Math.floor(now * 1e6));

	// Write the 64-bit (8-byte) integer directly to the WebAssembly memory view
	try
	{
		const view = new DataView(Module.memory.buffer);
		view.setBigUint64(tpAddr, totalNanoseconds, true); // true = Little Endian
	} catch(err)
	{
		// Fallback in case memory.buffer isn't immediately exposed on 'Module'
		const heapView = new DataView(HEAPU8.buffer);
		heapView.setBigUint64(tpAddr, totalNanoseconds, true);
	}

	return 0; // Success
}



Object.assign(FS, FILED);

if(typeof module != 'undefined')
{
	// SOMETHING SOMETHING fs.writeFile
	module.exports = FS;
}

/*

function callsysNew(argvPtr) {
	const cmdArgs = getStringsFromArgv(argvPtr);
	const targetKey = cmdArgs[0];

	try {
		const parentPid = api.pid;
		const childPid = parentPid + 1;

		// 1. Initialize the POSIX File Actions Table
		// By default, POSIX inherits all descriptors unless explicitly closed or rearranged.
		// We initialize a map of Child FD -> Parent FD
		const fdMap = {
			0: 0, // Child Stdin  <- Parent Stdin
			1: 1, // Child Stdout <- Parent Stdout
			2: 2  // Child Stderr <- Parent Stderr
		};

		// 2. PARSE REDIRECTIONS (Emulating posix_spawn_file_actions)
		// If your driver intercepts explicit layout rules, map them here.
		// Example: If a tool requests a closed stream or a file redirection:
		// To Close (Node 'ignore'): delete fdMap[fd]
		// To Pipe/Redirect:         fdMap[childFd] = parentFd

		// 3. EXECUTE PRE-SPAWN HOUSEKEEPING (Isolate Child Descriptor Space)
		// We generate a clean slate array for the child pointers based on the map
		const childPointers = [];

		Object.keys(fdMap).forEach((childFdStr) => {
			const childFd = parseInt(childFdStr, 10);
			const parentFd = fdMap[childFd];

			if (FS.pointers[parentFd]) {
				// Clone the pointer descriptor array structure:
				// [position, mode, node, path, fd, pid]
				const parentPointer = FS.pointers[parentFd];

				childPointers[childFd] = [
					parentPointer[0], // Inherit seek position
					parentPointer[1], // Inherit access mode
					parentPointer[2], // Inherit raw memory VFS Node object reference
					parentPointer[3], // Inherit file path string
					childFd,          // Assign the new target Child FD index
					childPid          // Assign ownership to the child execution thread
				];
			}
		});

		// 4. SWAP RUNTIME CONTEXT
		// Back up parent descriptors, and inject our child actions array layout
		const parentPointersBackup = [...FS.pointers];
		FS.pointers = childPointers;

		console.log(`[POSIX Spawn] Initializing Child Process ${childPid} file descriptor table.`);

		// 5. EXECUTE CHILD ENGINE PASS
		// Because FS.pointers now ONLY holds the mapped files, the child's internal
		// read/write routines are fully contained or isolated according to your setup.
		const result = api.runSync(targetKey, ...cmdArgs);

		// 6. CAPTURE CHILD ACTIONS & RESTORE PARENT
		// If the child opened or modified files (like generating an assembly block),
		// propagate those newly added virtual file descriptors back into the parent space.
		for (let i = 0; i < FS.pointers.length; i++) {
			if (FS.pointers[i] && i > 2) {
				// If the child allocated a fresh descriptor, restore it to the parent pool
				parentPointersBackup[i] = FS.pointers[i];
				parentPointersBackup[i][5] = parentPid; // Re-assign ownership to driver
			}
		}

		// Restore the full pointer array context back to the parent compiler driver
		FS.pointers = parentPointersBackup;

		return result;
	} catch (e) {
		console.log(`Execution failed for ${cmdArgs}: ${e.message}\n\r${e.stack}`);
		return 100;
	}
}

[RUN] q3lcc -v -v -Wf-g -S -Icode/game -Icode/cgame -Icode/q3_ui -DGAME code/game/g_main.c -o build/release-wasm-js/code/game/g_main.asm
q3lcc $Id$
[1:42:28 PM][RUN] q3cpp -D__STDC__=1 -D__STRICT_ANSI__ -D__signed__=signed -DQ3_VM -D__LCC__ -Icode/game -Icode/cgame -Icode/q3_ui -DGAME code/game/g_main.c /tmp/lcc10.i
cpp: code/game/bg_public.h:508 code/game/g_local.h:6 code/game/g_main.c:4 No newline at end of file
[1:42:33 PM][RUN] Allowing rAF after exit.
[1:42:33 PM][RUN] q3rcc -target=bytecode -v -g /tmp/lcc10.i build/release-wasm-js/code/game/g_main.asm
q3rcc $Name$($Id$)
0: warning: empty input file
rm /tmp/lcc10.i
[1:42:34 PM][RUN] Run succeeded: code/game/g_main.c


function callsysNew2(argvPtr) {
	const cmdArgs = getStringsFromArgv(argvPtr);
	const targetKey = cmdArgs[0];

	try {
		const parentPid = api.pid;
		const childPid = parentPid + 1;

		// Ensure our standard slots exist so freopen can safely read them
		if (!FS.pointers[0]) FS.pointers[0] = [0, 'r', { contents: new Uint8Array(0) }, '/dev/stdin', 0, parentPid];
		if (!FS.pointers[1]) FS.pointers[1] = [0, 'w', { contents: new Uint8Array(0) }, '/dev/stdout', 1, parentPid];
		if (!FS.pointers[2]) FS.pointers[2] = [0, 'w', { contents: new Uint8Array(0) }, '/dev/stderr', 2, parentPid];

		// Backup positions and tracks instead of stripping references out
		const parentFpState = FS.pointers.map(p => p ? [...p] : null);

		// Assign active PID contexts down the tree layout
		for (let i = 0; i < FS.pointers.length; i++) {
			if (FS.pointers[i]) {
				FS.pointers[i][5] = childPid;
			}
		}

		// Run the synchronized compilation pass
		const result = api.runSync(targetKey, ...cmdArgs);

		// Restore file tracking contexts cleanly back to the driver engine
		for (let i = 0; i < parentFpState.length; i++) {
			if (parentFpState[i]) {
				// Keep file content updates made by the child, but restore parent descriptors
				if (FS.pointers[i]) {
					parentFpState[i][0] = FS.pointers[i][0]; // Sync look position
				}
				FS.pointers[i] = parentFpState[i];
				FS.pointers[i][5] = parentPid; // Re-own
			}
		}

		return result;
	} catch (e) {
		console.log(`Execution failed for ${cmdArgs}: ${e.message}\n\r${e.stack}`);
		return 100;
	}
}

function callsys(argvPtr) {
	const cmdArgs = getStringsFromArgv(argvPtr);
	const targetKey = cmdArgs[0];

	try {
		// Track tracking dimensions across the POSIX bridge
		const startingFp = FS.pointers.length;
		const currentPid = api.pid;
		const targetChildPid = currentPid + 1; // Anticipate the next internal PID sequence

		// Run the child tool (e.g., q3cpp). It reads and writes directly to our shared VFS
		const result = api.runSync(targetKey, ...cmdArgs);

		const endingFp = FS.pointers.length;
		const opened = endingFp - startingFp;
		let leftOpen = 0;

		for (let i = startingFp + 1; i < endingFp; i++) {
			if (FS.pointers[i]) leftOpen++;
		}

		if (leftOpen > 0) {
			console.log(`[callsys] Process resulted in: ${result}. Releasing ${leftOpen} shared child file handles.`);

			for (let i = endingFp; i > startingFp; i--) {
				if (!FS.pointers[i]) continue;

				// If the handle belongs to our child pass execution loop, close it out clean
				if (FS.pointers[i][5] === targetChildPid || !FS.pointers[i][5]) {
					Sys_FClose(i);
				}
			}
		}

		return result;
	} catch (e) {
		console.log(`Execution failed for ${cmdArgs}: ${e.message}\n\r${e.stack}`);
		return 100; // Return clean error limits to lcc driver loop
	}
}
*/
