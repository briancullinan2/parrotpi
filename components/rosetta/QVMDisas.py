#!/usr/bin/env python
# encoding: utf-8
"""
QVMDisas.py

Created by Macpunk on 2009-09-20.
Updated by GrosBedo on 2010-04-12
Copyright (c) 2009 Dalton M. Cummings. All rights reserved.

CHANGELOG
== 2010-04-12
+ Added a better read of the qvm file (no more Invalid QVM file: length 400 not sane)
== 2010-04-27
+ The length check is not blocking anymore, because for some games (like OpenArena), the length can be sometimes different from what is calculated in the headers, but it works nevertheless.
"""

import sys, os, struct, re

#Binary file IO helper funcs

def readNone(data):
    return ''

def readU4(data):
    return struct.unpack('<I', data)[0]

def readI4(data):
    return struct.unpack('<i', data)[0]

def readF4(data):
    return struct.unpack('<f', data)[0]

def readU1(data):
    return struct.unpack('B', data)[0]

def readU2(data):
    return struct.unpack('<H', data)[0]

#QVM definitions

VM_MAGIC_VER1 = 0x12721444 #0x44147212 BE
VM_MAGIC_VER2 = 0x12721445 #0x45147212 BE

#Opcode table...
#It's like dis: opcode, mnemonic, decode func, argLength

opcode_list = [
    { 'opcode' : 0,  'mnemonic' : 'UNDEF',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 1,  'mnemonic' : 'IGNORE',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 2,  'mnemonic' : 'BREAK',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 3,  'mnemonic' : 'ENTER',         'decodeFunc' : readU4,    'argLength' : 4 },
    { 'opcode' : 4,  'mnemonic' : 'LEAVE',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 5,  'mnemonic' : 'CALL',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 6,  'mnemonic' : 'PUSH',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 7,  'mnemonic' : 'POP',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 8,  'mnemonic' : 'CONST',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 9,  'mnemonic' : 'LOCAL',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 10, 'mnemonic' : 'JUMP',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 11, 'mnemonic' : 'EQ',         'decodeFunc' : readI4,     'argLength' : 4 },
    { 'opcode' : 12, 'mnemonic' : 'NE',         'decodeFunc' : readI4,     'argLength' : 4 },
    { 'opcode' : 13, 'mnemonic' : 'LTI',         'decodeFunc' : readI4,     'argLength' : 4 },
    { 'opcode' : 14, 'mnemonic' : 'LEI',         'decodeFunc' : readI4,     'argLength' : 4 },
    { 'opcode' : 15, 'mnemonic' : 'GTI',         'decodeFunc' : readI4,     'argLength' : 4 },
    { 'opcode' : 16, 'mnemonic' : 'GEI',         'decodeFunc' : readI4,     'argLength' : 4 },
    { 'opcode' : 17, 'mnemonic' : 'LTU',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 18, 'mnemonic' : 'LEU',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 19, 'mnemonic' : 'GTU',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 20, 'mnemonic' : 'GEU',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 21, 'mnemonic' : 'EQF',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 22, 'mnemonic' : 'NEF',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 23, 'mnemonic' : 'LTF',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 24, 'mnemonic' : 'LEF',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 25, 'mnemonic' : 'GTF',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 26, 'mnemonic' : 'GEF',         'decodeFunc' : readU4,     'argLength' : 4 },
    { 'opcode' : 27, 'mnemonic' : 'LOAD1',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 28, 'mnemonic' : 'LOAD2',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 29, 'mnemonic' : 'LOAD4',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 30, 'mnemonic' : 'STORE1',     'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 31, 'mnemonic' : 'STORE2',     'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 32, 'mnemonic' : 'STORE4',     'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 33, 'mnemonic' : 'ARG',         'decodeFunc' : readU1,     'argLength' : 1 },
    { 'opcode' : 34, 'mnemonic' : 'BLOCK_COPY', 'decodeFunc' : readU4,    'argLength' : 4 },
    { 'opcode' : 35, 'mnemonic' : 'SEX8',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 36, 'mnemonic' : 'SEX16',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 37, 'mnemonic' : 'NEGI',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 38, 'mnemonic' : 'ADD',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 39, 'mnemonic' : 'SUB',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 40, 'mnemonic' : 'DIVI',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 41, 'mnemonic' : 'DIVU',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 42, 'mnemonic' : 'MODI',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 43, 'mnemonic' : 'MODU',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 44, 'mnemonic' : 'MULI',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 45, 'mnemonic' : 'MULU',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 46, 'mnemonic' : 'BAND',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 47, 'mnemonic' : 'BOR',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 48, 'mnemonic' : 'BXOR',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 49, 'mnemonic' : 'BCOM',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 50, 'mnemonic' : 'LSH',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 51, 'mnemonic' : 'RSHI',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 52, 'mnemonic' : 'RSHU',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 53, 'mnemonic' : 'NEGF',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 54, 'mnemonic' : 'ADDF',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 55, 'mnemonic' : 'SUBF',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 56, 'mnemonic' : 'DIVF',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 57, 'mnemonic' : 'MULF',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 58, 'mnemonic' : 'CVIF',         'decodeFunc' : None,     'argLength' : 0 },
    { 'opcode' : 59, 'mnemonic' : 'CVFI',         'decodeFunc' : None,     'argLength' : 0 }
]

numOpcodes = len(opcode_list)

class QVMProcedure:
    def __init__(self, qvm, start, end):
        self.qvm = qvm
        self.start = start
        self.end = end
        self.callers = []
        self.callees = []
        self.frameSize = 0
        self.name = 'sub_%08x' % (qvm.instructionPointers[start])
        self.instructionCount = self.end - self.start
        self.frameSize = readU4(self.qvm.codeSegment[self.qvm.instructionPointers[self.start] + 1 : self.qvm.instructionPointers[self.start + 1]])


    def disassemble(self, outputFile):

        index = self.start

        while index < self.end:
            opcode = readU1(self.qvm.codeSegment[self.qvm.instructionPointers[index]])

            if opcode > numOpcodes:
                outputFile.write('<0x%08x>: ***ILLEGAL OPCODE: 0x%x\n' % (self.qvm.instructionPointers[index], opcode))
                index += 1
                continue

            if opcode_list[opcode]['decodeFunc'] != None:
                arg = opcode_list[opcode]['decodeFunc'](self.qvm.codeSegment[self.qvm.instructionPointers[index] + 1 : self.qvm.instructionPointers[index] + 1 + opcode_list[opcode]['argLength']])
            else:
                arg = ''
            comment = ''

            if opcode == 8:
                #CONST instruction...

                if readU1(self.qvm.codeSegment[self.qvm.instructionPointers[index + 1]]) == 5:
                    #Function/syscall xref

                    if arg > 0x7FFFFFFF:
                        #syscall ref...
                        syscallNum = readI4(self.qvm.codeSegment[self.qvm.instructionPointers[index] + 1 : self.qvm.instructionPointers[index + 1]])

                        if syscallNum in self.qvm.syscalls:
                            comment = ';syscall[%i]: %s' % (syscallNum, self.qvm.syscalls[syscallNum])
                        else:
                            comment =  ';unknown syscall: %i' % (syscallNum)
                    else:
                        #function xref...
                        if arg in self.qvm.procedures:
                            comment = ';%s' % self.qvm.procedures[arg].name

                elif arg > self.qvm.header['dataLength'] and arg < self.qvm.header['dataLength'] + self.qvm.header['litLength']:
                    referencedStringStart = arg - self.qvm.header['dataLength']
                    referencedStringEnd = self.qvm.litSegment.find('\x00', referencedStringStart)
                    referencedString = self.qvm.litSegment[referencedStringStart : referencedStringEnd]
                    comment = ';string: "%s"' % (referencedString)

            if opcode_list[opcode]['decodeFunc'] != readF4 and opcode_list[opcode]['decodeFunc'] != None:
                arg = hex(arg)

            arg = str(arg).replace('L', '') #grrrr...fucking long notation

            outputFile.write('<0x%08x>: %s%s%s\n' % (self.qvm.instructionPointers[index],
                                                    opcode_list[opcode]['mnemonic'].ljust(10),
                                                    arg.ljust(30),
                                                    comment))

            index += 1

class QVM:
    def __init__(self, qvmFileName, syscallsFileName = None):
        self.qvmFileName = qvmFileName
        self.syscallsFileName = syscallsFileName

        #Open the file
        fh = open(self.qvmFileName, "rb")

        #Read it all into memory
        #fh.seek(0, os.SEEK_END)
        #size = fh.tell()
        #fh.seek(0, os.SEEK_SET)
        qvmsize = os.path.getsize(self.qvmFileName)
        self.bytes = fh.read(qvmsize)

        #close it up
        fh.close()

        #sanity check #1...
        if len(self.bytes) < 32:
            #FIXME: Offer error output interface in constructor, and stop using sys.exit
            sys.stdout.write('Invalid QVM file: length %i too small\n' % (len(self.bytes)))
            sys.exit()

        #Indexes are instruction numbers, elements are offset from start of CODE segment
        #That is [ 0, 5, 10, 15, 16, 17, ... ] for UrT v 4.1 cgame.qvm
        #Notice that the length of an instruction can be determined by instructionPointers[i+1] - instructionPointers[i]
        self.instructionPointers = []

        #Indexes are instruction numbers, elements are QVMProcedure objects
        self.procedures = {}

        #Keys are syscall numbers(all negative), values are syscall names(trap_* or actual system calls or math functions)
        self.syscalls = {}

        print 'Parsing header...'
        self.readHeader()

        #sanity check #2...
        if len(self.bytes) != self.header['dataOffset'] + self.header['dataLength'] + self.header['litLength']:
            headerfilelength = self.header['dataOffset'] + self.header['dataLength'] + self.header['litLength']
            sys.stdout.write('Invalid QVM file: length %i not sane, should be %s (read from headers), but continuing...\n' % (len(self.bytes), headerfilelength) )
            #sys.exit()

        self.codeSegment = self.bytes[self.header['codeOffset'] : self.header['codeOffset'] + self.header['codeLength']]
        self.dataSegment = self.bytes[self.header['dataOffset'] : self.header['dataOffset'] + self.header['dataLength']]
        self.litSegment = self.bytes[self.header['dataOffset'] + self.header['dataLength'] : self.header['dataOffset'] + self.header['dataLength'] + self.header['litLength']]

        #sanity check #3...
        if len(self.dataSegment) % 4 != 0:
            sys.stdout.write('Invalid QVM file: DATA segment not 4-byte aligned')
            sys.exit()

        print 'Done! Getting instruction pointers...'
        self.getInstructionPointers()
        print 'Done! Locating procedures...'
        self.locateProcedures()
        print 'Done! Resolving code xrefs...'
        self.resolveCodeXRefs()
        print 'Done! Locating strings...'
        self.locateStrings()
        print 'Done! Loading syscalls...'
        self.loadSyscalls(self.syscallsFileName)
        print 'Done!'


    def readHeader(self):

        self.header = {
            'magic'            : readU4(self.bytes[0:4]),
            'instructionCount' : readU4(self.bytes[4:8]),
            'codeOffset'       : readU4(self.bytes[8:12]),
            'codeLength'       : readU4(self.bytes[12:16]),
            'dataOffset'       : readU4(self.bytes[16:20]),
            'dataLength'       : readU4(self.bytes[20:24]),
            'litLength'           : readU4(self.bytes[24:28]),
            'bssLength'           : readU4(self.bytes[28:32])
        }

        #Wikipedia quote on Python ternary:
        #This form invites considering [0] as the normal value and [readU4(self.bytes[32:36])] as an exceptional case
        #Except this seems bass ackwards, because if magic is anything but 0x12721444 then we assume it's a more recent
        #QVM version. Which I'm guessing will still use Jump Table Args
        self.header['jtrgLength'] = 0 if self.header['magic'] == VM_MAGIC_VER1 else readU4(self.bytes[32:36])

    def getInstructionPointers(self):
        instructionCount = 0
        pc = 0

        while pc < self.header['codeLength']:
            self.instructionPointers.append(pc)

            opcode = readU1(self.codeSegment[pc])

            if opcode < numOpcodes:
                pc += opcode_list[opcode]['argLength']

            pc += 1

    def locateProcedures(self):
        index = 0
        procedureStart = None

        while index < len(self.instructionPointers):
            opcode = readU1(self.codeSegment[self.instructionPointers[index]])

            if opcode == 3:
                if procedureStart == None:
                    procedureStart = index
                else:
                    self.procedures[procedureStart] = QVMProcedure(self, procedureStart, index)
                    procedureStart = index
            index += 1

        #account for last procedure...
        self.procedures[procedureStart] = QVMProcedure(self, procedureStart, index)

    def locateStrings(self):
        pass

    def resolveCodeXRefs(self):
        index = 0
        currentProcedure = self.procedures[0]

        while index < len(self.instructionPointers):
            opcode = readU1(self.codeSegment[self.instructionPointers[index]])

            if opcode == 3:
                if index in self.procedures:
                    currentProcedure = self.procedures[index]
                    index += 1
                    continue
                else:
                    print "Could not find procedure at instruction %i [0x%08x]" % (index, self.instructionPointers[index])
                    sys.exit()

            elif opcode == 8 and readU1(self.codeSegment[self.instructionPointers[index + 1]]) == 5:
                target = readU4(self.codeSegment[self.instructionPointers[index] + 1 : self.instructionPointers[index + 1]])

                if target in self.procedures:

                    if currentProcedure not in self.procedures[target].callers:
                        self.procedures[target].callers.append(currentProcedure)

                    if self.procedures[target] not in currentProcedure.callees:
                        currentProcedure.callees.append(self.procedures[target])

            index += 1

    def loadSyscalls(self, syscallsFileName):

        if syscallsFileName == None:
            self.syscalls = {} #clear out the syscalls dictionary
            return

        self.syscallsFileName = syscallsFileName
        lines = open(syscallsFileName).readlines()

        for i in range(len(lines)):
            line = re.split('\s+', lines[i].strip())

            if len(line) != 3:
                continue

            self.syscalls[int(line[2])] = line[1]


if __name__ == '__main__':

    if len(sys.argv) < 2:
        sys.stdout.write('Usage: python %s <qvmFile> [optional syscallsFile]\nParameters can be used after the disassembly is done, type help at qvmd> command prompt.\n' % sys.argv[0])
        sys.exit()

    qvm = QVM(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)

    #Let's implement the different interactive commands...
    command = 0

    while True:
        try:
            command = raw_input('qvmd> ')

            #asys command
            if command.lower().startswith('asys'):
                if len(command.split()) < 3:
                    sys.stdout.write('Usage: asys <num> <name>\n')
                    continue

                command = command.split()

                try:
                    syscall = int(command[1])
                except ValueError:
                    sys.stdout.write('Invalid number specified.\n')
                    continue

                if syscall in qvm.syscalls:
                    sys.stdout.write('Sepcified syscall exists. Replace?[yes/no]: ')
                    answer = raw_input()
                    while answer.lower() != 'yes' and answer.lower() != 'no':
                        answer = raw_input('Please enter "yes" or "no": ')

                    if answer == 'no':
                        continue

                qvm.syscalls[syscall] = command[2]
                continue

            #disa command:
            elif command.lower().startswith('disa'):
                if len(command.split()) < 2:
                    sys.stdout.write('Usage: disa <address>\n')
                    continue

                command = command.split()

                try:
                    if command[1].lower().startswith('0x'):
                        address = int(command[1], 16)
                    else:
                        address = int(command[1])

                except ValueError:
                    sys.stdout.write('Invalid address given. Must be prefixed with "0x" if in base 16.\n')
                    continue

                if address > qvm.instructionPointers[len(qvm.instructionPointers) - 1]:
                    sys.stdout.write('Specified address out of range.\n')
                    continue

                found = False

                for instructionCount, procedure in qvm.procedures.iteritems():
                    if address >= qvm.instructionPointers[procedure.start] and address <= qvm.instructionPointers[procedure.end - 1]:
                        procedure.disassemble(sys.stdout)
                        found = True
                        break

                if found == False:
                    sys.stdout.write('No procedure found containing specified address.\n')

                continue

            #disi command
            elif command.lower().startswith('disi'):
                if len(command.split()) < 2:
                    sys.stdout.write('Usage: disi <instructionNumber>\n')
                    continue

                command = command.split()

                try:
                    if command[1].lower().startswith('0x'):
                        instruction = int(command[1], 16)
                    else:
                        instruction = int(command[1])

                except ValueError:
                    sys.stdout.write('Invalid instruction number given. Must be prefixed with "0x" if in base 16.\n')
                    continue

                if instruction > qvm.header['instructionCount']:
                    sys.stdout.write('Specified instruction number out of range.\n')
                    continue

                found = False

                for instructionCount, procedure in qvm.procedures.iteritems():
                    if instruction >= procedure.start and instruction <= procedure.end:
                        procedure.disassemble(sys.stdout)
                        found = True
                        break

                if found == False:
                    sys.stdout.write('No procedure found containing specified instruction number.\n')

                continue

            #disn command
            elif command.lower().startswith('disn') or command.lower().startswith('dis '):
                if len(command.partition(' ')) < 3:
                    sys.stdout.write('Usage: disn <regex>\n')
                    continue

                try:
                    command = command.partition(' ')
                    regex = re.compile(command[2])

                except re.error:
                    sys.stdout.write('Regex failed to compile correctly.\n')
                    sys.stdout.write(re.error.message)
                    continue

                found = False
                procedures = []

                for instructionCount, procedure in qvm.procedures.iteritems():
                    if regex.search(procedure.name) == None:
                        continue

                    procedures.append(procedure)
                    found = True

                if found == False:
                    sys.stdout.write('Specified procedure not found.\n' % ())
                elif len(procedures) > 1:
                    sys.stdout.write('\nMultiple procedures found:\n')
                    for procedure in procedures:
                        sys.stdout.write('%s\n' % (procedure.name))
                else:
                    procedures[0].disassemble(sys.stdout)

                continue

            #dump command
            elif command.lower().startswith('dump'):
                if len(command.split()) < 2:
                    sys.stdout.write('Usage: dump <file>\n')
                    continue

                fh = open(command.split()[1], 'w')

                fh.write('%s : 0x%x\n' % ('magic'.rjust(16), qvm.header['magic']))
                fh.write('%s : 0x%x\n' % ('instructionCount'.rjust(16), qvm.header['instructionCount']))
                fh.write('%s : 0x%x\n' % ('codeOffset'.rjust(16), qvm.header['codeOffset']))
                fh.write('%s : 0x%x\n' % ('codeLength'.rjust(16), qvm.header['codeLength']))
                fh.write('%s : 0x%x\n' % ('dataOffset'.rjust(16), qvm.header['dataOffset']))
                fh.write('%s : 0x%x\n' % ('dataLength'.rjust(16), qvm.header['dataLength']))
                fh.write('%s : 0x%x\n' % ('litLength'.rjust(16), qvm.header['litLength']))
                fh.write('%s : 0x%x\n' % ('bssLength'.rjust(16), qvm.header['bssLength']))
                fh.write('%s : 0x%x\n' % ('jtrgLength'.rjust(16), qvm.header['jtrgLength']))

                fh.write('\n\n')

                for key in sorted(qvm.procedures.keys()):
                    fh.write('==========[%s]==========\n' % (qvm.procedures[key].name))
                    fh.write('Frame size: %d\n' % (qvm.procedures[key].frameSize))
                    fh.write('Instruction count: %d [start: %d][end: %d]\n' % (qvm.procedures[key].instructionCount, qvm.procedures[key].start, qvm.procedures[key].end))
                    fh.write('Address: 0x%08x\n' % (qvm.instructionPointers[qvm.procedures[key].start]))
                    fh.write('Called by %d funcs: ' % (len(qvm.procedures[key].callers)))

                    names = []

                    for caller in qvm.procedures[key].callers:
                        names.append(caller.name)

                    fh.write('%s\n' % (', '.join(names)))

                    fh.write('Calls %d funcs: ' % (len(qvm.procedures[key].callees)))
                    names = []
                    for callee in qvm.procedures[key].callees:
                        names.append(callee.name)

                    fh.write('%s\n\n' % (', '.join(names)))

                    qvm.procedures[key].disassemble(fh)
                    fh.write('\n\n')

                fh.flush()
                fh.close()
                continue

            #header command
            elif command.lower().startswith('header'):

                sys.stdout.write('\n')

                for key, value in qvm.header.iteritems():
                    sys.stdout.write('%s : 0x%x\n' % (key.rjust(16), value))

                sys.stdout.write('\n')
                continue

            #help command
            elif command.lower().startswith('help'):
                sys.stdout.write('\n')
                sys.stdout.write('\tasys <num> <name>         - Add system call <num> with name <name>.\n')
                sys.stdout.write('\tdis <name>                - Alias for disn.\n')
                sys.stdout.write('\tdisa <address>            - Disassemble procedure containing address <address>.\n')
                sys.stdout.write('\tdisi <instructionNumber>  - Disassemble procedure containing instruction number <instructionNumber>.\n')
                sys.stdout.write('\tdisn <regex>              - Disassemble procedure matching regular expression <regex>.\n')
                sys.stdout.write('\tdump <file>               - Dump detailed disassembly to file <file>\n')
                sys.stdout.write('\theader                    - Print readable form of the QVM header.\n')
                sys.stdout.write('\thelp                      - Print this help message.\n')
                sys.stdout.write('\tinfo <name>               - Print information known for procedure <name>.\n')
                sys.stdout.write('\tlsys                      - List currently known system calls.\n')
                sys.stdout.write('\tname <origName> <newName> - Rename procedure <origName> to <newName>.\n')
                sys.stdout.write('\tosys <file>               - Open file <file> specifying system calls using equ statements.\n')
                sys.stdout.write('\tquit                      - Quit QVMDisas.py. Ctrl-D also quits.\n')
                sys.stdout.write('\tsref <regex>              - Print all procedures referencing strings matching regular expression <regex>.\n')
                sys.stdout.write('\tssys <file>               - Save currently known system calls to file <file> using equ statements.\n')
                sys.stdout.write('\n')
                continue

            #info command
            elif command.lower().startswith('info'):
                if len(command.split()) < 2:
                    sys.stdout.write('Usage: info <name>\n')
                    continue

                found = False

                for instructionCount, procedure in qvm.procedures.iteritems():
                    if procedure.name == command.split()[1]:

                        sys.stdout.write('Frame size: %d\n' % (procedure.frameSize))
                        sys.stdout.write('Instruction count: %d [start: %d][end: %d]\n' % (procedure.instructionCount, procedure.start, procedure.end))
                        sys.stdout.write('Address: 0x%08x\n' % (qvm.instructionPointers[procedure.start]))
                        sys.stdout.write('Called by %d funcs: ' % (len(procedure.callers)))

                        names = []

                        for caller in procedure.callers:
                            names.append(caller.name)

                        sys.stdout.write('%s\n' % (', '.join(names)))

                        sys.stdout.write('Calls %d funcs: ' % (len(procedure.callees)))
                        names = []
                        for callee in procedure.callees:
                            names.append(callee.name)

                        sys.stdout.write('%s\n\n' % (', '.join(names)))

                        found = True
                        break

                if found == False:
                    sys.stdout.write('Specified procedure not found.\n')

                continue

            #lsys command
            elif command.lower().startswith('lsys'):
                for key in sorted(qvm.syscalls.keys()):
                    sys.stdout.write('%d - %s\n' % (key, qvm.syscalls[key]))

                continue

            #name command
            elif command.lower().startswith('name'):
                if len(command.split()) < 3:
                    sys.stdout.write('Usage: name <origName> <newName>\n')
                    continue

                command = command.split()

                found = False

                for instructionCount, procedure in qvm.procedures.iteritems():
                    if procedure.name == command[1]:
                        procedure.name = command[2]
                        found = True
                        break

                if found == False:
                    sys.stdout.write('Specified procedure not found.\n')

                continue

            #osys command
            elif command.lower().startswith('osys'):
                if len(command.split()) < 2:
                    sys.stdout.write('Usage: osys <file>\n')
                    continue

                command = command.partition(' ')
                try:
                    qvm.loadSyscalls(command[2])
                except IOError:
                    sys.stdout.write('Specified file does not exist.\n')

                continue

            #quit command
            elif command.lower().startswith('quit'):
                sys.stdout.write('\n')
                sys.exit()

            #sref command
            elif command.lower().startswith('sref'):
                if len(command.split()) < 2:
                    sys.stdout.write('Usage: sref <regex>\n')
                    continue

                try:
                    command = command.partition(' ')
                    regex = re.compile(command[2])

                except re.error:
                    sys.stdout.write('Regex failed to compile correctly.\n')
                    sys.stdout.write(re.error.message)
                    continue

                procedures = []
                index = 0
                currentProcedure = None

                while index < len(qvm.instructionPointers):
                    opcode = readU1(qvm.codeSegment[qvm.instructionPointers[index]])

                    if opcode == 3:
                        currentProcedure = qvm.procedures[index]
                        index += 1
                        continue

                    if opcode == 8 and readU1(qvm.codeSegment[qvm.instructionPointers[index] + opcode_list[opcode]['argLength']]) != 5:
                        arg = readU4(qvm.codeSegment[qvm.instructionPointers[index] + 1 : qvm.instructionPointers[index] + 5])

                        if arg >= qvm.header['dataLength'] and arg < qvm.header['dataLength'] + qvm.header['litLength']:
                            referencedStringStart = arg - qvm.header['dataLength']
                            referencedStringEnd = qvm.litSegment.find('\x00', referencedStringStart)
                            referencedString = qvm.litSegment[referencedStringStart : referencedStringEnd]

                            if regex.search(referencedString) == None:
                                index += 1
                                continue

                            if currentProcedure not in procedures:
                                procedures.append(currentProcedure)

                    index += 1

                if len(procedures) < 1:
                    sys.stdout.write('No string references matching specified regex found.\n')
                    continue

                for procedure in procedures:
                    sys.stdout.write('%s\n' % (procedure.name))

                continue

            #ssys command
            elif command.lower().startswith('ssys'):
                if len(command.split()) < 2:
                    sys.stdout.write('Usage: ssys <file>\n')
                    continue

                fh = open(command.split()[1], 'w')

                syscalls = []
                for key in sorted(qvm.syscalls.keys()):
                    syscalls.append('equ %s %d' % (qvm.syscalls[key], key))

                fh.writelines(syscalls)
                fh.close()

                continue

            if command != "":
                sys.stdout.write('Unknown command "%s"' % (command.split()[0]))

        except KeyboardInterrupt:
            sys.stdout.write('\n')
            continue
        except EOFError:
            sys.stdout.write('\n')
            sys.exit()
