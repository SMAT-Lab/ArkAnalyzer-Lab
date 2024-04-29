import * as fs from 'fs';
import fs__default from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { configure, getLogger } from 'log4js';
import * as ts from 'typescript';
import ts__default from 'typescript';
import sourceMap from 'source-map';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

var LOG_LEVEL;
(function (LOG_LEVEL) {
    LOG_LEVEL["ERROR"] = "ERROR";
    LOG_LEVEL["WARN"] = "WARN";
    LOG_LEVEL["INFO"] = "INFO";
    LOG_LEVEL["DEBUG"] = "DEBUG";
    LOG_LEVEL["TRACE"] = "TRACE";
})(LOG_LEVEL || (LOG_LEVEL = {}));
class ConsoleLogger {
    static configure(logFilePath, level) {
        configure({
            appenders: {
                file: {
                    type: 'fileSync',
                    filename: `${logFilePath}`,
                    maxLogSize: 5 * 1024 * 1024,
                    backups: 5,
                    compress: true,
                    encoding: 'utf-8',
                    layout: {
                        type: 'pattern',
                        pattern: '[%d] [%p] [%z] [ArkAnalyzer] - %m',
                    },
                },
                console: {
                    type: 'console',
                    layout: {
                        type: 'pattern',
                        pattern: '[%d] [%p] [%z] [ArkAnalyzer] - %m',
                    },
                },
            },
            categories: {
                default: {
                    appenders: ['console'],
                    level: 'info',
                    enableCallStack: false,
                },
                codelinter: {
                    appenders: ['file'],
                    level,
                    enableCallStack: true,
                },
            },
        });
    }
    static getLogger() {
        return getLogger('codelinter');
    }
    static setLogLevel(level) {
        getLogger('codelinter').level = level;
    }
}

const logger$f = ConsoleLogger.getLogger();
/**
 * This class is used to manage all the configurations set up for the analyzer.
 */
class Config {
    constructor(projectName, project_dir, sdkName, sdk_dir) {
        this.projectName = projectName;
        this.project_dir = project_dir;
        this.sdkName = sdkName;
        this.sdk_dir = sdk_dir;
    }
}
class SceneConfig {
    constructor() {
        this.configJsonPath = "";
        this.targetProjectName = "";
        this.targetProjectDirectory = "";
        this.targetProjectOriginDirectory = '';
        this.ohosSdkPath = "";
        this.kitSdkPath = "";
        this.systemSdkPath = "";
        this.otherSdkMap = new Map();
        this.sdkFiles = [];
        this.sdkFilesMap = new Map();
        this.projectFiles = [];
        this.logPath = "./out/ArkAnalyzer.log";
        this.hosEtsLoaderPath = '';
    }
    //----for ArkCiD------
    buildFromJson(configJsonPath) {
        this.configJsonPath = configJsonPath;
        this.genConfig();
        this.getAllFiles();
    }
    buildFromProjectDir(targetProjectDirectory) {
        this.targetProjectDirectory = targetProjectDirectory;
        this.targetProjectName = path.basename(targetProjectDirectory);
        ConsoleLogger.configure(this.logPath, LOG_LEVEL.ERROR);
        this.getAllFiles();
    }
    buildFromIde(targetProjectName, targetProjectOriginDirectory, targetProjectDirectory, sdkEtsPath, logPath) {
        return __awaiter(this, void 0, void 0, function* () {
            this.targetProjectName = targetProjectName;
            this.targetProjectOriginDirectory = targetProjectOriginDirectory;
            this.targetProjectDirectory = path.join(targetProjectDirectory, targetProjectName);
            this.ohosSdkPath = path.join(sdkEtsPath, './api');
            this.kitSdkPath = path.join(sdkEtsPath, './kits');
            this.hosEtsLoaderPath = path.join(sdkEtsPath, './build-tools/ets-loader');
            this.logPath = logPath;
            ConsoleLogger.configure(this.logPath, LOG_LEVEL.ERROR);
            yield spawnSync('node', [path.join(__dirname, 'ets2ts.js'), this.hosEtsLoaderPath, this.targetProjectOriginDirectory, targetProjectDirectory, this.targetProjectName, this.logPath]);
            this.getAllFiles();
        });
    }
    genConfig() {
        if (fs__default.existsSync(this.configJsonPath)) {
            let configurations = JSON.parse(fs__default.readFileSync(this.configJsonPath, "utf8"));
            this.targetProjectName = configurations.targetProjectName;
            this.targetProjectDirectory = configurations.targetProjectDirectory;
            this.logPath = configurations.logPath;
            ConsoleLogger.configure(this.logPath, LOG_LEVEL.ERROR);
            this.ohosSdkPath = configurations.ohosSdkPath;
            this.kitSdkPath = configurations.kitSdkPath;
            this.systemSdkPath = configurations.systemSdkPath;
            let otherSdks = [];
            for (let sdk of configurations.otherSdks) {
                otherSdks.push(JSON.parse(JSON.stringify(sdk)));
            }
            otherSdks.forEach((sdk) => {
                if (sdk.name && sdk.path) {
                    this.otherSdkMap.set(sdk.name, sdk.path);
                }
            });
        }
        else {
            throw new Error(`Your configJsonPath: "${this.configJsonPath}" is not exist.`);
        }
    }
    getAllFiles() {
        if (this.targetProjectDirectory) {
            let tmpFiles = getFiles(this.targetProjectDirectory, "\\.ts\$");
            this.projectFiles.push(...tmpFiles);
        }
        else {
            throw new Error('TargetProjectDirectory is wrong.');
        }
        if (this.ohosSdkPath) {
            let ohosFiles = getFiles(this.ohosSdkPath, "\\.d\\.ts\$");
            this.sdkFiles.push(...ohosFiles);
            this.sdkFilesMap.set(ohosFiles, "ohos");
        }
        if (this.kitSdkPath) {
            let kitFiles = getFiles(this.kitSdkPath, "\\.d\\.ts\$");
            this.sdkFiles.push(...kitFiles);
            this.sdkFilesMap.set(kitFiles, "kit");
        }
        if (this.systemSdkPath) {
            let systemFiles = getFiles(this.systemSdkPath, "\\.d\\.ts\$");
            this.sdkFiles.push(...systemFiles);
            this.sdkFilesMap.set(systemFiles, "system");
        }
        if (this.otherSdkMap.size != 0) {
            this.otherSdkMap.forEach((value, key) => {
                let otherSdkFiles = getFiles(value, "\\.d\\.ts\$");
                this.sdkFiles.push(...otherSdkFiles);
                this.sdkFilesMap.set(otherSdkFiles, key);
            });
        }
    }
    getTargetProjectName() {
        return this.targetProjectName;
    }
    getTargetProjectDirectory() {
        return this.targetProjectDirectory;
    }
    getTargetProjectOriginDirectory() {
        return this.targetProjectOriginDirectory;
    }
    getProjectFiles() {
        return this.projectFiles;
    }
    getSdkFiles() {
        return this.sdkFiles;
    }
    getSdkFilesMap() {
        return this.sdkFilesMap;
    }
    getOhosSdkPath() {
        return this.ohosSdkPath;
    }
    getKitSdkPath() {
        return this.kitSdkPath;
    }
    getSystemSdkPath() {
        return this.systemSdkPath;
    }
    getOtherSdkMap() {
        return this.otherSdkMap;
    }
    getLogPath() {
        return this.logPath;
    }
}
function getFiles(srcPath, fileExt, tmpFiles = []) {
    let extReg = new RegExp(fileExt);
    if (!fs__default.existsSync(srcPath)) {
        logger$f.info("Input directory is not exist: ", srcPath);
        return tmpFiles;
    }
    const realSrc = fs__default.realpathSync(srcPath);
    let files2Do = fs__default.readdirSync(realSrc);
    for (let fileName of files2Do) {
        if (fileName == 'oh_modules' || fileName == 'node_modules') {
            continue;
        }
        const realFile = path.resolve(realSrc, fileName);
        if (fs__default.statSync(realFile).isDirectory()) {
            getFiles(realFile, fileExt, tmpFiles);
        }
        else {
            if (extReg.test(realFile)) {
                tmpFiles.push(realFile);
            }
        }
    }
    return tmpFiles;
}

class Type {
}
/** any type */
class AnyType extends Type {
    static getInstance() {
        return this.INSTANCE;
    }
    constructor() {
        super();
    }
    toString() {
        return 'any';
    }
}
AnyType.INSTANCE = new AnyType();
/** unknown type */
class UnknownType extends Type {
    static getInstance() {
        return this.INSTANCE;
    }
    constructor() {
        super();
    }
    toString() {
        return 'unknown';
    }
}
UnknownType.INSTANCE = new UnknownType();
/** unclear type */
class UnclearReferenceType extends Type {
    constructor(name) {
        super();
        this.name = name;
    }
    getName() {
        return this.name;
    }
    toString() {
        return this.name;
    }
}
/** primitive type */
class PrimitiveType extends Type {
    constructor(name) {
        super();
        this.name = name;
    }
    getName() {
        return this.name;
    }
    toString() {
        return this.name;
    }
}
class BooleanType extends PrimitiveType {
    constructor() {
        super('boolean');
    }
    static getInstance() {
        return this.INSTANCE;
    }
}
BooleanType.INSTANCE = new BooleanType();
class NumberType extends PrimitiveType {
    constructor() {
        super('number');
    }
    static getInstance() {
        return this.INSTANCE;
    }
}
NumberType.INSTANCE = new NumberType();
class StringType extends PrimitiveType {
    constructor() {
        super('string');
    }
    static getInstance() {
        return this.INSTANCE;
    }
}
StringType.INSTANCE = new StringType();
/** null type */
class NullType extends PrimitiveType {
    static getInstance() {
        return this.INSTANCE;
    }
    constructor() {
        super('null');
    }
}
NullType.INSTANCE = new NullType();
/** undefined type */
class UndefinedType extends PrimitiveType {
    static getInstance() {
        return this.INSTANCE;
    }
    constructor() {
        super('undefined');
    }
}
UndefinedType.INSTANCE = new UndefinedType();
/** literal type */
class LiteralType extends PrimitiveType {
    constructor(literalName) {
        super('literal');
        this.literalName = literalName;
    }
    getliteralName() {
        return this.literalName;
    }
    toString() {
        return this.getName() + ': ' + this.literalName;
    }
}
/** union type */
class UnionType extends Type {
    constructor(types, currType = UnknownType.getInstance()) {
        super();
        this.types = [...types];
        this.currType = currType;
    }
    getTypes() {
        return this.types;
    }
    getCurrType() {
        return this.currType;
    }
    setCurrType(newType) {
        this.currType = newType;
    }
    toString() {
        let typeStr = this.types.join('|');
        if (!(this.currType instanceof UnknownType) && this.currType != this) {
            typeStr += '-' + this.currType;
        }
        return typeStr;
    }
}
// types for function
/** void return type */
class VoidType extends Type {
    static getInstance() {
        return this.INSTANCE;
    }
    constructor() {
        super();
    }
    toString() {
        return 'void';
    }
}
VoidType.INSTANCE = new VoidType();
class NeverType extends Type {
    static getInstance() {
        return this.INSTANCE;
    }
    constructor() {
        super();
    }
    toString() {
        return 'never';
    }
}
NeverType.INSTANCE = new NeverType();
/** callable type */
class CallableType extends Type {
    constructor(methodSignature) {
        super();
        this.methodSignature = methodSignature;
    }
    getMethodSignature() {
        return this.methodSignature;
    }
    toString() {
        return this.methodSignature.toString();
    }
}
/** type of an object */
class ClassType extends Type {
    constructor(classSignature) {
        super();
        this.classSignature = classSignature;
    }
    getClassSignature() {
        return this.classSignature;
    }
    setClassSignature(newClassSignature) {
        this.classSignature = newClassSignature;
    }
    toString() {
        return this.classSignature.toString();
    }
}
class ArrayType extends Type {
    constructor(baseType, dimension) {
        super();
        this.baseType = baseType;
        this.dimension = dimension;
    }
    getBaseType() {
        return this.baseType;
    }
    getDimension() {
        return this.dimension;
    }
    toString() {
        const strs = [];
        strs.push('(' + this.baseType.toString() + ')');
        for (let i = 0; i < this.dimension; i++) {
            strs.push('[]');
        }
        return strs.join('');
    }
}
class ArrayObjectType extends ArrayType {
    constructor(baseType, dimension) {
        super(baseType, dimension);
    }
    toString() {
        return 'Array<' + this.getBaseType() + '>[]';
    }
}
class TupleType extends Type {
    constructor(types) {
        super();
        this.types = types;
    }
    getTypes() {
        return this.types;
    }
    toString() {
        return '[' + this.types.join(', ') + ']';
    }
}
class AliasType extends Type {
    constructor(originalType) {
        super();
        this.originalType = originalType;
    }
    getOriginalType() {
        return this.originalType;
    }
    toString() {
        return 'alias: ' + this.originalType;
    }
}
/** type of the type alias for the class*/
class ClassAliasType extends AliasType {
    constructor(classType) {
        super(classType);
    }
}
class TypeLiteralType extends Type {
    constructor() {
        super();
        this.members = [];
    }
    getMembers() {
        return this.members;
    }
    setMembers(members) {
        this.members = members;
    }
    addMember(member) {
        this.members.push(member);
    }
    toString() {
        let strMembers = [];
        this.members.forEach((member) => {
            strMembers.push(member.getName().toString());
        });
        return '[' + strMembers.join(', ') + ']';
    }
}
class AnnotationType extends Type {
    constructor(originType) {
        super();
        this.originType = originType;
    }
    getOriginType() {
        return this.originType;
    }
    toString() {
        return this.originType;
    }
}
class AnnotationNamespaceType extends AnnotationType {
    constructor(originType) {
        super(originType);
    }
    getOriginType() {
        return super.getOriginType();
    }
}
class AnnotationTypeQueryType extends AnnotationType {
    constructor(originType) {
        super(originType);
    }
}

class Local {
    constructor(name, type = UnknownType.getInstance()) {
        this.name = name;
        this.type = type;
        this.originalValue = null;
        this.declaringStmt = null;
        this.usedStmts = [];
    }
    getName() {
        return this.name;
    }
    setName(name) {
        this.name = name;
    }
    getType() {
        return this.type;
    }
    setType(newType) {
        this.type = newType;
    }
    getOriginalValue() {
        return this.originalValue;
    }
    setOriginalValue(originalValue) {
        this.originalValue = originalValue;
    }
    getDeclaringStmt() {
        return this.declaringStmt;
    }
    setDeclaringStmt(declaringStmt) {
        this.declaringStmt = declaringStmt;
    }
    getUses() {
        return [];
    }
    addUsedStmt(usedStmt) {
        this.usedStmts.push(usedStmt);
    }
    getUsedStmts() {
        return this.usedStmts;
    }
    toString() {
        return this.getName();
    }
}

const logger$e = ConsoleLogger.getLogger();
class AbstractRef {
}
class ArkArrayRef extends AbstractRef {
    constructor(base, index) {
        super();
        this.base = base;
        this.index = index;
    }
    getBase() {
        return this.base;
    }
    setBase(newBase) {
        this.base = newBase;
    }
    getIndex() {
        return this.index;
    }
    setIndex(newIndex) {
        this.index = newIndex;
    }
    getType() {
        const baseType = this.base.getType();
        if (baseType instanceof ArrayType) {
            return baseType.getBaseType();
        }
        else {
            logger$e.warn(`the type of base in ArrayRef is not ArrayType`);
            return UnknownType.getInstance();
        }
    }
    getUses() {
        let uses = [];
        uses.push(this.base);
        uses.push(...this.base.getUses());
        uses.push(this.index);
        uses.push(...this.index.getUses());
        return uses;
    }
    toString() {
        return this.base + '[' + this.index + ']';
    }
}
class AbstractFieldRef extends AbstractRef {
    constructor(fieldSignature) {
        super();
        this.fieldSignature = fieldSignature;
    }
    getFieldName() {
        return this.fieldSignature.getFieldName();
    }
    getFieldSignature() {
        return this.fieldSignature;
    }
    setFieldSignature(newFieldSignature) {
        this.fieldSignature = newFieldSignature;
    }
    getType() {
        return this.fieldSignature.getType();
    }
}
class ArkInstanceFieldRef extends AbstractFieldRef {
    constructor(base, fieldSignature) {
        super(fieldSignature);
        this.base = base;
    }
    getBase() {
        return this.base;
    }
    setBase(newBase) {
        this.base = newBase;
    }
    getUses() {
        let uses = [];
        uses.push(this.base);
        uses.push(...this.base.getUses());
        return uses;
    }
    toString() {
        return this.base.toString() + '.<' + this.getFieldSignature() + '>';
    }
}
class ArkStaticFieldRef extends AbstractFieldRef {
    constructor(fieldSignature) {
        super(fieldSignature);
    }
    getUses() {
        let uses = [];
        return uses;
    }
    toString() {
        return this.getFieldSignature().toString();
    }
}
class ArkParameterRef extends AbstractRef {
    constructor(index, paramType) {
        super();
        this.index = index;
        this.paramType = paramType;
    }
    getIndex() {
        return this.index;
    }
    getType() {
        return this.paramType;
    }
    getUses() {
        let uses = [];
        return uses;
    }
    toString() {
        return 'parameter' + this.index + ': ' + this.paramType;
    }
}
class ArkThisRef extends AbstractRef {
    constructor(type) {
        super();
        this.type = type;
    }
    getType() {
        return this.type;
    }
    getUses() {
        let uses = [];
        return uses;
    }
    toString() {
        return 'this: ' + this.type;
    }
}
class ArkCaughtExceptionRef extends AbstractRef {
    constructor(type) {
        super();
        this.type = type;
    }
    getType() {
        return this.type;
    }
    getUses() {
        let uses = [];
        return uses;
    }
    toString() {
        return 'caughtexception: ' + this.type;
    }
}

/**
 * Replace old use of a Expr inplace
 */
class ExprUseReplacer {
    constructor(oldUse, newUse) {
        this.oldUse = oldUse;
        this.newUse = newUse;
    }
    // TODO:是否将该逻辑移Expr具体类中，利用多态实现
    caseExpr(expr) {
        if (expr instanceof ArkBinopExpr) {
            this.caseBinopExp(expr);
        }
        else if (expr instanceof AbstractInvokeExpr) {
            this.caseInvokeExpr(expr);
        }
        else if (expr instanceof ArkNewArrayExpr) {
            this.caseNewArrayExpr(expr);
        }
        else if (expr instanceof ArkBinopExpr) {
            this.caseBinopExpr(expr);
        }
        else if (expr instanceof ArkTypeOfExpr) {
            this.caseTypeOfExpr(expr);
        }
        else if (expr instanceof ArkInstanceOfExpr) {
            this.caseInstanceOfExpr(expr);
        }
        else if (expr instanceof ArkLengthExpr) {
            this.caseLengthExpr(expr);
        }
        else if (expr instanceof ArkCastExpr) {
            this.caseCastExpr(expr);
        }
    }
    caseBinopExp(expr) {
        if (expr.getOp1() == this.oldUse) {
            expr.setOp1(this.newUse);
        }
        if (expr.getOp2() == this.oldUse) {
            expr.setOp2(this.newUse);
        }
    }
    caseInvokeExpr(expr) {
        let args = expr.getArgs();
        for (let i = 0; i < args.length; i++) {
            if (args[i] == this.oldUse) {
                args[i] = this.newUse;
            }
        }
        if (expr instanceof ArkInstanceInvokeExpr && expr.getBase() == this.oldUse) {
            expr.setBase(this.newUse);
        }
    }
    caseNewArrayExpr(expr) {
        if (expr.getSize() == this.oldUse) {
            expr.setSize(this.newUse);
        }
    }
    caseBinopExpr(expr) {
        if (expr.getOp1() == this.oldUse) {
            expr.setOp1(this.newUse);
        }
        if (expr.getOp2() == this.oldUse) {
            expr.setOp2(this.newUse);
        }
    }
    caseTypeOfExpr(expr) {
        if (expr.getOp() == this.oldUse) {
            expr.setOp(this.newUse);
        }
    }
    caseInstanceOfExpr(expr) {
        if (expr.getOp() == this.oldUse) {
            expr.setOp(this.newUse);
        }
    }
    caseLengthExpr(expr) {
        if (expr.getOp() == this.oldUse) {
            expr.setOp(this.newUse);
        }
    }
    caseCastExpr(expr) {
        if (expr.getOp() == this.oldUse) {
            expr.setOp(this.newUse);
        }
    }
}

/**
 * Replace old use of a Ref inplace
 */
class RefUseReplacer {
    constructor(oldUse, newUse) {
        this.oldUse = oldUse;
        this.newUse = newUse;
    }
    // TODO:是否将该逻辑移Ref具体类中，利用多态实现
    caseRef(ref) {
        if (ref instanceof ArkInstanceFieldRef) {
            this.caseFieldRef(ref);
        }
        else if (ref instanceof ArkArrayRef) {
            this.caseArrayRef(ref);
        }
    }
    caseFieldRef(ref) {
        if (ref.getBase() == this.oldUse) {
            ref.setBase(this.newUse);
        }
    }
    caseArrayRef(ref) {
        if (ref.getBase() == this.oldUse) {
            ref.setBase(this.newUse);
        }
        else if (ref.getIndex() == this.oldUse) {
            ref.setIndex(this.newUse);
        }
    }
}

/**
 * Replace old use(Value) of a Stmt inplace
 */
class StmtUseReplacer {
    constructor(oldUse, newUse) {
        this.oldUse = oldUse;
        this.newUse = newUse;
    }
    // TODO:是否将该逻辑移Stmt具体类中，利用多态实现
    caseStmt(stmt) {
        if (stmt instanceof ArkAssignStmt) {
            this.caseAssignStmt(stmt);
        }
        else if (stmt instanceof ArkInvokeStmt) {
            this.caseInvokeStmt(stmt);
        }
        else if (stmt instanceof ArkReturnStmt) {
            this.caseReturnStmt(stmt);
        }
        else if (stmt instanceof ArkIfStmt) {
            this.caseIfStmt(stmt);
        }
    }
    caseAssignStmt(stmt) {
        let rValue = stmt.getRightOp();
        if (rValue == this.oldUse) {
            stmt.setRightOp(this.newUse);
        }
        else if (rValue instanceof Local) {
            if (rValue == this.oldUse) {
                stmt.setRightOp(this.newUse);
            }
        }
        else if (rValue instanceof AbstractRef) {
            if (rValue == this.oldUse) {
                stmt.setRightOp(this.newUse);
            }
            else {
                let refUseReplacer = new RefUseReplacer(this.oldUse, this.newUse);
                refUseReplacer.caseRef(rValue);
            }
        }
        else if (rValue instanceof AbstractExpr) {
            if (rValue == this.oldUse) {
                stmt.setRightOp(this.newUse);
            }
            else {
                let exprUseReplacer = new ExprUseReplacer(this.oldUse, this.newUse);
                exprUseReplacer.caseExpr(rValue);
            }
        }
    }
    caseInvokeStmt(stmt) {
        let exprUseReplacer = new ExprUseReplacer(this.oldUse, this.newUse);
        exprUseReplacer.caseExpr(stmt.getInvokeExpr());
    }
    caseReturnStmt(stmt) {
        stmt.setReturnValue(this.newUse);
    }
    caseIfStmt(stmt) {
        let exprUseReplacer = new ExprUseReplacer(this.oldUse, this.newUse);
        exprUseReplacer.caseExpr(stmt.getConditionExprExpr());
    }
}

class Position {
}
class LinePosition {
    constructor(lineNo) {
        this.lineNo = lineNo;
    }
    getLineNo() {
        return this.lineNo;
    }
}
class LineColPosition {
    constructor(lineNo, colNo) {
        this.lineNo = lineNo;
        this.colNo = colNo;
    }
    getLineNo() {
        return this.lineNo;
    }
    getColNo() {
        return this.colNo;
    }
    static buildFromNode(node, sourceFile) {
        let { line, character } = ts__default.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        // line start from 1.
        return new LineColPosition(line + 1, character + 1);
    }
}

class Stmt {
    constructor() {
        this.text = '';
        this.def = null;
        this.uses = [];
        this.originPosition = 0;
        this.position = 0;
        this.cfg = null;
        this.originColumn = -1;
        this.column = -1;
    }
    /** Return a list of values which are uesd in this statement */
    getUses() {
        let uses = [];
        for (const use of this.uses) {
            if (!(use instanceof AbstractExpr)) {
                uses.push(use);
            }
        }
        return uses;
    }
    addUse(use) {
        this.uses.push(use);
    }
    replaceUse(oldUse, newUse) {
        let stmtUseReplacer = new StmtUseReplacer(oldUse, newUse);
        stmtUseReplacer.caseStmt(this);
    }
    replaceUses(uses) {
        this.uses = Array.from(uses);
    }
    /** Return the def which is uesd in this statement */
    getDef() {
        return this.def;
    }
    setDef(def) {
        this.def = def;
    }
    getCfg() {
        return this.cfg;
    }
    setCfg(cfg) {
        this.cfg = cfg;
    }
    /**
     * Return true if the following statement may not execute after this statement.
     * The ArkIfStmt and ArkGotoStmt will return true.
     */
    isBranch() {
        return false;
    }
    /** Return the number of statements which this statement may go to */
    getExpectedSuccessorCount() {
        return 1;
    }
    containsInvokeExpr() {
        for (const use of this.uses) {
            if (use instanceof AbstractInvokeExpr) {
                return true;
            }
        }
        return false;
    }
    replaceInvokeExpr(newInvokeExpr) {
        for (let i = 0; i < this.uses.length; i++) {
            if (this.uses[i] instanceof AbstractInvokeExpr) {
                this.uses[i] = newInvokeExpr;
            }
        }
    }
    getInvokeExpr() {
        for (const use of this.uses) {
            if (use instanceof AbstractInvokeExpr) {
                return use;
            }
        }
        return undefined;
    }
    getExprs() {
        let exprs = [];
        for (const use of this.uses) {
            if (use instanceof AbstractExpr) {
                exprs.push(use);
            }
        }
        return exprs;
    }
    containsArrayRef() {
        for (const use of this.uses) {
            if (use instanceof ArkArrayRef) {
                return true;
            }
        }
        if (this.def instanceof ArkArrayRef) {
            return true;
        }
        return false;
    }
    getArrayRef() {
        for (const use of this.uses) {
            if (use instanceof ArkArrayRef) {
                return use;
            }
        }
        if (this.def instanceof ArkArrayRef) {
            return undefined;
        }
        return undefined;
    }
    containsFieldRef() {
        for (const use of this.uses) {
            if (use instanceof AbstractFieldRef) {
                return true;
            }
        }
        if (this.def instanceof AbstractFieldRef) {
            return true;
        }
        return false;
    }
    getFieldRef() {
        for (const use of this.uses) {
            if (use instanceof AbstractFieldRef) {
                return use;
            }
        }
        if (this.def instanceof AbstractFieldRef) {
            return undefined;
        }
        return undefined;
    }
    setPositionInfo(position) {
        this.position = position;
    }
    getPositionInfo() {
        return this.position;
    }
    setOriginPositionInfo(originPosition) {
        this.originPosition = originPosition;
    }
    getOriginPositionInfo() {
        return this.originPosition;
    }
    setEtsPositionInfo(position) {
        this.etsPosition = position;
    }
    getEtsPositionInfo(arkFile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.etsPosition) {
                const etsPosition = yield arkFile.getEtsOriginalPositionFor(new LineColPosition(this.originPosition, this.originColumn));
                this.setEtsPositionInfo(etsPosition);
            }
            return this.etsPosition;
        });
    }
    setColumn(nweColumn) {
        this.column = nweColumn;
    }
    getColumn() {
        return this.column;
    }
    setOriginColumn(newOriginColumn) {
        this.originColumn = newOriginColumn;
    }
    getOriginColumn() {
        return this.originColumn;
    }
    toString() {
        return this.text;
    }
    setText(text) {
        this.text = text;
    }
    updateText() {
        this.text = this.toString();
    }
}
class ArkAssignStmt extends Stmt {
    constructor(leftOp, rightOp) {
        super();
        this.leftOp = leftOp;
        this.rightOp = rightOp;
        this.setDef(leftOp);
        this.updateUses();
        this.updateText();
    }
    getLeftOp() {
        return this.leftOp;
    }
    setLeftOp(newLeftOp) {
        this.leftOp = newLeftOp;
        this.setDef(newLeftOp);
        this.updateText();
    }
    getRightOp() {
        return this.rightOp;
    }
    setRightOp(rightOp) {
        this.rightOp = rightOp;
        this.updateUses();
        this.updateText();
    }
    toString() {
        const str = this.getLeftOp() + " = " + this.getRightOp();
        this.setText(str);
        return str;
    }
    updateUses() {
        let uses = [];
        uses.push(...this.leftOp.getUses());
        uses.push(this.rightOp);
        uses.push(...this.rightOp.getUses());
        this.replaceUses(uses);
    }
}
class ArkInvokeStmt extends Stmt {
    constructor(invokeExpr) {
        super();
        this.invokeExpr = invokeExpr;
        this.updateUses();
        this.updateText();
    }
    replaceInvokeExpr(newExpr) {
        this.invokeExpr = newExpr;
        this.updateUses();
        this.updateText();
    }
    getInvokeExpr() {
        return this.invokeExpr;
    }
    toString() {
        const str = this.invokeExpr.toString();
        this.setText(str);
        return str;
    }
    updateUses() {
        let uses = [];
        uses.push(this.invokeExpr);
        uses.push(...this.invokeExpr.getUses());
        this.replaceUses(uses);
    }
}
class ArkIfStmt extends Stmt {
    constructor(conditionExpr) {
        super();
        this.conditionExpr = conditionExpr;
        this.updateUses();
        this.updateText();
    }
    getConditionExprExpr() {
        return this.conditionExpr;
    }
    isBranch() {
        return true;
    }
    getExpectedSuccessorCount() {
        return 2;
    }
    toString() {
        const str = 'if ' + this.conditionExpr;
        this.setText(str);
        return str;
    }
    updateUses() {
        let uses = [];
        uses.push(this.conditionExpr);
        uses.push(...this.conditionExpr.getUses());
        this.replaceUses(uses);
    }
}
class ArkGotoStmt extends Stmt {
    constructor() {
        super();
        this.updateText();
    }
    isBranch() {
        return true;
    }
    toString() {
        const str = 'goto';
        this.setText(str);
        return str;
    }
}
class ArkReturnStmt extends Stmt {
    constructor(op) {
        super();
        this.op = op;
        this.updateUses();
        this.updateText();
    }
    getExpectedSuccessorCount() {
        return 0;
    }
    getOp() {
        return this.op;
    }
    setReturnValue(returnValue) {
        this.op = returnValue;
        this.updateUses();
        this.updateText();
    }
    toString() {
        const str = 'return ' + this.op;
        this.setText(str);
        return str;
    }
    updateUses() {
        let uses = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        this.replaceUses(uses);
    }
}
class ArkReturnVoidStmt extends Stmt {
    constructor() {
        super();
        this.updateText();
    }
    getExpectedSuccessorCount() {
        return 0;
    }
    toString() {
        const str = 'return';
        this.setText(str);
        return str;
    }
}
class ArkNopStmt extends Stmt {
    constructor() {
        super();
        this.updateText();
    }
    toString() {
        const str = 'nop';
        this.setText(str);
        return str;
    }
}
class ArkSwitchStmt extends Stmt {
    constructor(key, cases) {
        super();
        this.key = key;
        this.cases = cases;
        this.updateUses();
        this.updateText();
    }
    getKey() {
        return this.key;
    }
    getCases() {
        return this.cases;
    }
    isBranch() {
        return true;
    }
    getExpectedSuccessorCount() {
        return this.cases.length + 1;
    }
    toString() {
        let strs = [];
        strs.push('switch(' + this.key + ') {');
        for (const c of this.cases) {
            strs.push('case ');
            strs.push(c.toString());
            strs.push(': ');
            strs.push(', ');
        }
        strs.push('default : }');
        const str = strs.join('');
        this.setText(str);
        return str;
    }
    updateUses() {
        let uses = [];
        uses.push(this.key);
        uses.push(...this.key.getUses());
        this.replaceUses(uses);
    }
}
class ArkDeleteStmt extends Stmt {
    constructor(field) {
        super();
        this.field = field;
        this.updateUses();
        this.updateText();
    }
    getField() {
        return this.field;
    }
    setField(newField) {
        this.field = newField;
    }
    toString() {
        const str = 'delete ' + this.field;
        this.setText(str);
        return str;
    }
    updateUses() {
        let uses = [];
        uses.push(this.field);
        uses.push(...this.field.getUses());
        this.replaceUses(uses);
    }
}
class ArkThrowStmt extends Stmt {
    constructor(op) {
        super();
        this.op = op;
        this.updateUses();
        this.updateText();
    }
    getOp() {
        return this.op;
    }
    toString() {
        const str = 'throw ' + this.op;
        this.setText(str);
        return str;
    }
    updateUses() {
        let uses = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        this.replaceUses(uses);
    }
}

function transfer2UnixPath(path2Do) {
    return path.posix.join(...path2Do.split(/\\/));
}

class FileSignature {
    constructor() {
        this.projectName = "_UnkownProjectName";
        this.fileName = "_UnkownFileName";
    }
    getProjectName() {
        return this.projectName;
    }
    setProjectName(projectName) {
        this.projectName = projectName;
    }
    getFileName() {
        return this.fileName;
    }
    setFileName(fileName) {
        this.fileName = fileName;
    }
    toString() {
        let tmpSig = transfer2UnixPath(this.fileName);
        // remove file ext: '.d.ts' or '.ts'
        tmpSig = tmpSig.replace(/\.d\.ts|\.ts$/, '');
        tmpSig = '@' + this.projectName + '/' + tmpSig + ': ';
        return tmpSig;
    }
}
class NamespaceSignature {
    constructor() {
        this.namespaceName = "";
        this.declaringFileSignature = new FileSignature();
        this.declaringNamespaceSignature = null;
    }
    getNamespaceName() {
        return this.namespaceName;
    }
    setNamespaceName(namespaceName) {
        this.namespaceName = namespaceName;
    }
    getDeclaringFileSignature() {
        return this.declaringFileSignature;
    }
    setDeclaringFileSignature(declaringFileSignature) {
        this.declaringFileSignature = declaringFileSignature;
    }
    getDeclaringNamespaceSignature() {
        return this.declaringNamespaceSignature;
    }
    setDeclaringNamespaceSignature(declaringNamespaceSignature) {
        this.declaringNamespaceSignature = declaringNamespaceSignature;
    }
    toString() {
        if (this.declaringNamespaceSignature) {
            return this.declaringNamespaceSignature.toString() + '.' + this.namespaceName;
        }
        else {
            return this.declaringFileSignature.toString() + this.namespaceName;
        }
    }
}
class ClassSignature {
    getDeclaringFileSignature() {
        return this.declaringFileSignature;
    }
    setDeclaringFileSignature(declaringFileSignature) {
        this.declaringFileSignature = declaringFileSignature;
    }
    getDeclaringNamespaceSignature() {
        return this.declaringNamespaceSignature;
    }
    setDeclaringNamespaceSignature(declaringNamespaceSignature) {
        this.declaringNamespaceSignature = declaringNamespaceSignature;
    }
    getClassName() {
        return this.className;
    }
    setClassName(className) {
        this.className = className;
    }
    getType() {
        return new ClassType(this);
    }
    constructor() {
        this.declaringFileSignature = new FileSignature();
        this.declaringNamespaceSignature = null;
        this.className = "";
    }
    toString() {
        if (this.declaringNamespaceSignature) {
            return this.declaringNamespaceSignature.toString() + '.' + this.className;
        }
        else {
            return this.declaringFileSignature.toString() + this.className;
        }
    }
}
class FieldSignature {
    getDeclaringClassSignature() {
        return this.declaringClassSignature;
    }
    setDeclaringClassSignature(declaringClassSignature) {
        this.declaringClassSignature = declaringClassSignature;
    }
    getFieldName() {
        return this.fieldName;
    }
    setFieldName(fieldName) {
        this.fieldName = fieldName;
    }
    setType(newType) {
        this.type = newType;
    }
    getType() {
        return this.type;
    }
    constructor() {
        this.declaringClassSignature = new ClassSignature();
        this.fieldName = '';
        this.type = UnknownType.getInstance();
    }
    toString() {
        return this.getDeclaringClassSignature().toString() + '.' + this.getFieldName();
    }
}
class MethodSubSignature {
    getMethodName() {
        return this.methodName;
    }
    setMethodName(methodName) {
        this.methodName = methodName;
    }
    getParameters() {
        return this.parameters;
    }
    getParameterTypes() {
        return this.parameterTypes;
    }
    setParameters(parameter) {
        this.parameters = parameter;
        parameter.forEach((value) => {
            this.parameterTypes.add(value.getType());
        });
    }
    getReturnType() {
        return this.returnType;
    }
    setReturnType(returnType) {
        this.returnType = returnType;
    }
    constructor() {
        this.methodName = '';
        this.parameters = [];
        this.parameterTypes = new Set();
        this.returnType = UnknownType.getInstance();
    }
    toString() {
        let paraStr = "";
        this.parameterTypes.forEach((parameterType) => {
            paraStr += parameterType.toString() + ", ";
        });
        paraStr = paraStr.replace(/, $/, '');
        return `${this.getMethodName()}(${paraStr})`;
    }
}
class MethodSignature {
    getDeclaringClassSignature() {
        return this.declaringClassSignature;
    }
    setDeclaringClassSignature(declaringClassSignature) {
        this.declaringClassSignature = declaringClassSignature;
    }
    getMethodSubSignature() {
        return this.methodSubSignature;
    }
    setMethodSubSignature(methodSubSig) {
        this.methodSubSignature = methodSubSig;
    }
    getType() {
        return this.methodSubSignature.getReturnType();
    }
    constructor() {
        this.declaringClassSignature = new ClassSignature();
        this.methodSubSignature = new MethodSubSignature();
    }
    toString() {
        return this.declaringClassSignature.toString() + '.' + this.methodSubSignature.toString();
    }
}
class InterfaceSignature {
    getArkFile() {
        return this.arkFile;
    }
    setArkFile(arkFile) {
        this.arkFile = arkFile;
    }
    getInterfaceName() {
        return this.interfaceName;
    }
    setInterfaceName(interfaceName) {
        this.interfaceName = interfaceName;
    }
    constructor() {
        this.arkFile = '';
        this.interfaceName = '';
        this.arkFileWithoutExt = '';
    }
    build(arkFile, interfaceName) {
        this.setArkFile(arkFile);
        this.setInterfaceName(interfaceName);
        this.arkFileWithoutExt = path.dirname(arkFile) + '/' + path.basename(arkFile, path.extname(arkFile));
    }
    toString() {
        return `<${this.getArkFile()}>.<#Interface#>.<${this.getInterfaceName()}>`;
    }
}
//TODO, reconstruct
function fieldSignatureCompare(leftSig, rightSig) {
    if (classSignatureCompare(leftSig.getDeclaringClassSignature(), rightSig.getDeclaringClassSignature()) &&
        (leftSig.getFieldName() == rightSig.getFieldName())) {
        return true;
    }
    return false;
}
function methodSignatureCompare(leftSig, rightSig) {
    if (classSignatureCompare(leftSig.getDeclaringClassSignature(), rightSig.getDeclaringClassSignature()) &&
        methodSubSignatureCompare(leftSig.getMethodSubSignature(), rightSig.getMethodSubSignature())) {
        return true;
    }
    return false;
}
function methodSubSignatureCompare(leftSig, rightSig) {
    if ((leftSig.getMethodName() == rightSig.getMethodName()) && setCompare(leftSig.getParameterTypes(), rightSig.getParameterTypes()) && leftSig.getReturnType() == rightSig.getReturnType()) {
        return true;
    }
    return false;
}
function classSignatureCompare(leftSig, rightSig) {
    if ((fileSignatureCompare(leftSig.getDeclaringFileSignature(), rightSig.getDeclaringFileSignature())) &&
        (leftSig.getClassName() == rightSig.getClassName())) {
        return true;
    }
    return false;
}
function fileSignatureCompare(leftSig, rightSig) {
    if ((leftSig.getFileName() == rightSig.getFileName()) && (leftSig.getProjectName() == rightSig.getProjectName())) {
        return true;
    }
    return false;
}
function arrayCompare(leftArray, rightArray) {
    if (leftArray.length != rightArray.length) {
        return false;
    }
    for (let i = 0; i < leftArray.length; i++) {
        if (leftArray[i] != rightArray[i]) {
            return false;
        }
    }
    return true;
}
function setCompare(leftSet, rightSet) {
    const arr1 = Array.from(leftSet);
    const arr2 = Array.from(rightSet);
    return arrayCompare(arr1, arr2);
}
function genSignature4ImportClause(arkFileName, importClauseName) {
    return `<${arkFileName}>.<${importClauseName}>`;
}

class ModelUtils {
    static getMethodSignatureFromArkClass(arkClass, methodName) {
        for (const arkMethod of arkClass.getMethods()) {
            if (arkMethod.getName() == methodName) {
                return arkMethod.getSignature();
            }
        }
        return null;
    }
    /** search class iteratively with ClassSignature */
    static getClassWithClassSignature(classSignature, scene) {
        return scene.getClass(classSignature);
    }
    static getMethodWithMethodSignature(methodSignature, scene) {
        const arkClass = this.getClassWithClassSignature(methodSignature.getDeclaringClassSignature(), scene);
        return arkClass.getMethod(methodSignature);
    }
    static getClassWithNameInNamespaceRecursively(className, ns) {
        if (className == '') {
            return null;
        }
        let res = null;
        res = this.getClassInNamespaceWithName(className, ns);
        if (res == null) {
            let declaringNs = ns.getDeclaringArkNamespace();
            if (declaringNs != null) {
                res = this.getClassWithNameInNamespaceRecursively(className, declaringNs);
            }
            else {
                res = this.getClassInFileWithName(className, ns.getDeclaringArkFile());
            }
        }
        return res;
    }
    static getClassWithNameFromClass(className, startFrom) {
        if (!className.includes(".")) {
            let res = null;
            if (startFrom.getDeclaringArkNamespace() != null) {
                res = this.getClassWithNameInNamespaceRecursively(className, startFrom.getDeclaringArkNamespace());
            }
            else {
                res = this.getClassInFileWithName(className, startFrom.getDeclaringArkFile());
            }
            return res;
        }
        else {
            const names = className.split('.');
            let nameSpace = this.getNamespaceWithNameFromClass(names[0], startFrom);
            for (let i = 1; i < names.length - 1; i++) {
                if (nameSpace)
                    nameSpace = this.getNamespaceInNamespaceWithName(names[i], nameSpace);
            }
            if (nameSpace) {
                return this.getClassInNamespaceWithName(names[names.length - 1], nameSpace);
            }
        }
        return null;
    }
    /** search class within the file that contain the given method */
    static getClassWithName(className, startFrom) {
        //TODO:是否支持类表达式
        if (!className.includes(".")) {
            const thisClass = startFrom.getDeclaringArkClass();
            if (thisClass.getName() == className) {
                return thisClass;
            }
            const thisNamespace = thisClass.getDeclaringArkNamespace();
            let classSearched = null;
            if (thisNamespace) {
                classSearched = this.getClassInNamespaceWithName(className, thisNamespace);
                if (classSearched) {
                    return classSearched;
                }
            }
            const thisFile = thisClass.getDeclaringArkFile();
            classSearched = this.getClassInFileWithName(className, thisFile);
            return classSearched;
        }
        else {
            const names = className.split('.');
            let nameSpace = this.getNamespaceWithName(names[0], startFrom);
            for (let i = 1; i < names.length - 1; i++) {
                if (nameSpace)
                    nameSpace = this.getNamespaceInNamespaceWithName(names[i], nameSpace);
            }
            if (nameSpace) {
                return this.getClassInNamespaceWithName(names[names.length - 1], nameSpace);
            }
        }
        return null;
    }
    /** search class within the given namespace */
    static getClassInNamespaceWithName(className, arkNamespace) {
        for (const arkClass of arkNamespace.getClasses()) {
            if (arkClass.getName() == className) {
                return arkClass;
            }
        }
        return null;
    }
    /** search class within the given file */
    static getClassInFileWithName(className, arkFile) {
        for (const arkClass of arkFile.getClasses()) {
            if (arkClass.getName() == className) {
                return arkClass;
            }
        }
        return this.getClassInImportInfoWithName(className, arkFile);
    }
    static getClassInImportInfoWithName(className, arkFile) {
        for (const importInfo of arkFile.getImportInfos()) {
            if (importInfo.getImportClauseName() == className) {
                const importFrom = this.getFileFromImportInfo(importInfo, arkFile.getScene());
                if (importFrom) {
                    const nameBefroreAs = importInfo.getNameBeforeAs();
                    if (nameBefroreAs != undefined) {
                        className = nameBefroreAs;
                    }
                    return this.getClassInImportFileWithName(className, importFrom);
                }
            }
        }
        return null;
    }
    static getClassInImportFileWithName(className, arkFile) {
        let defaultExport = null;
        for (const exportInfo of arkFile.getExportInfos()) {
            if (exportInfo.getExportClauseName() == className) {
                const nameBefroreAs = exportInfo.getNameBeforeAs();
                if (nameBefroreAs != undefined) {
                    className = nameBefroreAs;
                }
                for (const arkClass of arkFile.getClasses()) {
                    if (arkClass.getName() == className) {
                        return arkClass;
                    }
                }
                return this.getClassInImportInfoWithName(className, arkFile);
            }
            else if (exportInfo.getDefault()) {
                defaultExport = exportInfo;
            }
        }
        if (defaultExport) {
            className = defaultExport.getExportClauseName();
            for (const arkClass of arkFile.getClasses()) {
                if (arkClass.getName() == className) {
                    return arkClass;
                }
            }
            return this.getClassInImportInfoWithName(className, arkFile);
        }
        return null;
    }
    static getFileFromImportInfo(importInfo, scene) {
        const signatureStr = importInfo.getImportFromSignature2Str();
        let file = null;
        if (importInfo.getImportProjectType() == "TargetProject") {
            file = scene.getFiles().find(file => file.getFileSignature().toString() == signatureStr) || null;
        }
        else if (importInfo.getImportProjectType() == "SDKProject") {
            file = scene.getSdkArkFilestMap().get(signatureStr) || null;
        }
        return file;
    }
    /** search method within the file that contain the given method */
    static getMethodWithName(methodName, startFrom) {
        if (startFrom.getName() == methodName) {
            return startFrom;
        }
        const thisClass = startFrom.getDeclaringArkClass();
        let methodSearched = this.getMethodInClassWithName(methodName, thisClass);
        if (methodSearched) {
            return methodSearched;
        }
        return null;
    }
    /** search method within the given class */
    static getMethodInClassWithName(methodName, arkClass) {
        for (const method of arkClass.getMethods()) {
            if (method.getName() == methodName) {
                return method;
            }
        }
        return null;
    }
    /** search field within the given class */
    static getFieldInClassWithName(fieldName, arkClass) {
        for (const field of arkClass.getFields()) {
            if (field.getName() == fieldName) {
                return field;
            }
        }
        return null;
    }
    static getNamespaceWithNameFromClass(namespaceName, startFrom) {
        const thisNamespace = startFrom.getDeclaringArkNamespace();
        let namespaceSearched = null;
        if (thisNamespace) {
            namespaceSearched = this.getNamespaceInNamespaceWithName(namespaceName, thisNamespace);
            if (namespaceSearched) {
                return namespaceSearched;
            }
        }
        const thisFile = startFrom.getDeclaringArkFile();
        namespaceSearched = this.getNamespaceInFileWithName(namespaceName, thisFile);
        return namespaceSearched;
    }
    static getNamespaceWithName(namespaceName, startFrom) {
        const thisClass = startFrom.getDeclaringArkClass();
        const thisNamespace = thisClass.getDeclaringArkNamespace();
        let namespaceSearched = null;
        if (thisNamespace) {
            namespaceSearched = this.getNamespaceInNamespaceWithName(namespaceName, thisNamespace);
            if (namespaceSearched) {
                return namespaceSearched;
            }
        }
        const thisFile = thisClass.getDeclaringArkFile();
        namespaceSearched = this.getNamespaceInFileWithName(namespaceName, thisFile);
        return namespaceSearched;
    }
    static getNamespaceInNamespaceWithName(namespaceName, arkNamespace) {
        for (const namespace of arkNamespace.getNamespaces()) {
            if (namespace.getName() == namespaceName) {
                return namespace;
            }
        }
        return null;
    }
    static getNamespaceInFileWithName(namespaceName, arkFile) {
        for (const namespace of arkFile.getNamespaces()) {
            if (namespace.getName() == namespaceName) {
                return namespace;
            }
        }
        return this.getNamespaceInImportInfoWithName(namespaceName, arkFile);
    }
    static getNamespaceInImportInfoWithName(namespaceName, arkFile) {
        for (const importInfo of arkFile.getImportInfos()) {
            if (importInfo.getImportClauseName() == namespaceName) {
                const importFrom = this.getFileFromImportInfo(importInfo, arkFile.getScene());
                if (importFrom) {
                    const nameBefroreAs = importInfo.getNameBeforeAs();
                    if (nameBefroreAs != undefined) {
                        namespaceName = nameBefroreAs;
                    }
                    return this.getNamespaceInImportFileWithName(namespaceName, importFrom);
                }
            }
        }
        return null;
    }
    static getNamespaceInImportFileWithName(namespaceName, arkFile) {
        let defaultExport = null;
        for (const exportInfo of arkFile.getExportInfos()) {
            if (exportInfo.getExportClauseName() == namespaceName) {
                const nameBefroreAs = exportInfo.getNameBeforeAs();
                if (nameBefroreAs != undefined) {
                    namespaceName = nameBefroreAs;
                }
                for (const arkNamespace of arkFile.getNamespaces()) {
                    if (arkNamespace.getName() == namespaceName) {
                        return arkNamespace;
                    }
                }
                return this.getNamespaceInImportInfoWithName(namespaceName, arkFile);
            }
            else if (exportInfo.getDefault()) {
                defaultExport = exportInfo;
            }
        }
        if (defaultExport) {
            namespaceName = defaultExport.getExportClauseName();
            for (const arkNamespace of arkFile.getNamespaces()) {
                if (arkNamespace.getName() == namespaceName) {
                    return arkNamespace;
                }
            }
            return this.getNamespaceInImportInfoWithName(namespaceName, arkFile);
        }
        return null;
    }
    static getStaticMethodWithName(methodName, startFrom) {
        const thisClass = startFrom.getDeclaringArkClass();
        const thisNamespace = thisClass.getDeclaringArkNamespace();
        if (thisNamespace) {
            const defaultClass = thisNamespace.getClasses().find(cls => cls.getName() == '_DEFAULT_ARK_CLASS') || null;
            if (defaultClass) {
                const method = this.getMethodInClassWithName(methodName, defaultClass);
                if (method) {
                    return method;
                }
            }
        }
        return this.getStaticMethodInFileWithName(methodName, startFrom.getDeclaringArkFile());
    }
    static getStaticMethodInFileWithName(methodName, arkFile) {
        const defaultClass = arkFile.getClasses().find(cls => cls.getName() == '_DEFAULT_ARK_CLASS') || null;
        if (defaultClass) {
            let method = this.getMethodInClassWithName(methodName, defaultClass);
            if (method) {
                return method;
            }
        }
        return this.getStaticMethodInImportInfoWithName(methodName, arkFile);
    }
    static getStaticMethodInImportInfoWithName(methodName, arkFile) {
        for (const importInfo of arkFile.getImportInfos()) {
            if (importInfo.getImportClauseName() == methodName) {
                const importFrom = this.getFileFromImportInfo(importInfo, arkFile.getScene());
                if (importFrom) {
                    const nameBefroreAs = importInfo.getNameBeforeAs();
                    if (nameBefroreAs != undefined) {
                        methodName = nameBefroreAs;
                    }
                    return this.getStaticMethodInImportFileWithName(methodName, importFrom);
                }
            }
        }
        return null;
    }
    static getStaticMethodInImportFileWithName(methodName, arkFile) {
        let defaultExport = null;
        for (const exportInfo of arkFile.getExportInfos()) {
            if (exportInfo.getExportClauseName() == methodName) {
                const defaultClass = arkFile.getClasses().find(cls => cls.getName() == '_DEFAULT_ARK_CLASS') || null;
                if (defaultClass) {
                    const nameBefroreAs = exportInfo.getNameBeforeAs();
                    if (nameBefroreAs != undefined) {
                        methodName = nameBefroreAs;
                    }
                    for (const arkMethod of defaultClass.getMethods()) {
                        if (arkMethod.getName() == methodName) {
                            return arkMethod;
                        }
                    }
                    return this.getStaticMethodInImportInfoWithName(methodName, arkFile);
                }
            }
            else if (exportInfo.getDefault()) {
                defaultExport = exportInfo;
            }
        }
        if (defaultExport) {
            methodName = defaultExport.getExportClauseName();
            const defaultClass = arkFile.getClasses().find(cls => cls.getName() == '_DEFAULT_ARK_CLASS') || null;
            if (defaultClass) {
                for (const arkMethod of defaultClass.getMethods()) {
                    if (arkMethod.getName() == methodName) {
                        return arkMethod;
                    }
                }
                return this.getStaticMethodInImportInfoWithName(methodName, arkFile);
            }
        }
        return null;
    }
}

class ArkField {
    constructor() {
        this.name = "";
        this.code = "";
        this.fieldType = "";
        this.parameters = [];
        this.typeParameters = [];
        this.modifiers = new Set();
        this.questionToken = false;
        this.exclamationToken = false;
    }
    getDeclaringClass() {
        return this.declaringClass;
    }
    setDeclaringClass(declaringClass) {
        this.declaringClass = declaringClass;
    }
    getCode() {
        return this.code;
    }
    setCode(code) {
        this.code = code;
    }
    getFieldType() {
        return this.fieldType;
    }
    setFieldType(fieldType) {
        this.fieldType = fieldType;
    }
    getName() {
        return this.name;
    }
    setName(name) {
        this.name = name;
    }
    getType() {
        return this.type;
    }
    setType(type) {
        this.type = type;
    }
    getParameters() {
        return this.parameters;
    }
    setParameters(parameters) {
        this.parameters = parameters;
    }
    addParameter(parameter) {
        this.typeParameters.push(parameter);
    }
    getTypeParameters() {
        return this.typeParameters;
    }
    setTypeParameters(typeParameters) {
        this.typeParameters = typeParameters;
    }
    addTypeParameters(typeParameter) {
        this.typeParameters.push(typeParameter);
    }
    getModifiers() {
        return this.modifiers;
    }
    addModifier(modifier) {
        this.modifiers.add(modifier);
    }
    getSignature() {
        return this.fieldSignature;
    }
    setSignature(fieldSig) {
        this.fieldSignature = fieldSig;
    }
    genSignature() {
        let fieldSig = new FieldSignature();
        fieldSig.setType(this.type);
        fieldSig.setDeclaringClassSignature(this.declaringClass.getSignature());
        fieldSig.setFieldName(this.name);
        this.setSignature(fieldSig);
    }
    getInitializer() {
        return this.initializer;
    }
    setInitializer(initializer) {
        this.initializer = initializer;
    }
    isStatic() {
        if (this.modifiers.has("StaticKeyword")) {
            return true;
        }
        return false;
    }
    isProtected() {
        if (this.modifiers.has("ProtectedKeyword")) {
            return true;
        }
        return false;
    }
    isPrivate() {
        if (this.modifiers.has("PrivateKeyword")) {
            return true;
        }
        return false;
    }
    isPublic() {
        if (this.modifiers.has("PublicKeyword")) {
            return true;
        }
        return false;
    }
    isReadonly() {
        if (this.modifiers.has("ReadonlyKeyword")) {
            return true;
        }
        return false;
    }
    setQuestionToken(questionToken) {
        this.questionToken = questionToken;
    }
    setExclamationToken(exclamationToken) {
        this.exclamationToken = exclamationToken;
    }
    getQuestionToken() {
        return this.questionToken;
    }
    getExclamationToken() {
        return this.exclamationToken;
    }
    setOriginPosition(position) {
        this.originPosition = position;
    }
    getOriginPosition() {
        return this.originPosition;
    }
    setEtsPositionInfo(position) {
        this.etsPosition = position;
    }
    getEtsPositionInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.etsPosition) {
                let arkFile = this.declaringClass.getDeclaringArkFile();
                const etsPosition = yield arkFile.getEtsOriginalPositionFor(this.originPosition);
                this.setEtsPositionInfo(etsPosition);
            }
            return this.etsPosition;
        });
    }
    setArkMethodSignature(methodSignature) {
        this.arkMethodSignature = methodSignature;
    }
    getArkMethodSignature() {
        return this.arkMethodSignature;
    }
}

class ArkBody {
    constructor(methodSignature, locals, originalCfg, cfg) {
        this.methodSignature = methodSignature;
        this.locals = locals;
        this.originalCfg = originalCfg;
        this.cfg = cfg;
    }
    getLocals() {
        return this.locals;
    }
    setLocals(locals) {
        this.locals = locals;
    }
    getCfg() {
        return this.cfg;
    }
    setCfg(cfg) {
        this.cfg = cfg;
    }
    getOriginalCfg() {
        return this.originalCfg;
    }
    setOriginalCfg(originalCfg) {
        this.originalCfg = originalCfg;
    }
    getMethodSignature() {
        return this.methodSignature;
    }
    setMethodSignature(methodSignature) {
        this.methodSignature = methodSignature;
    }
}

const logger$d = ConsoleLogger.getLogger();
class ObjectBindingPatternParameter {
    constructor() {
        this.propertyName = "";
        this.name = "";
        this.optional = false;
        this.initializer = "";
    }
    getName() {
        return this.name;
    }
    setName(name) {
        this.name = name;
    }
    getPropertyName() {
        return this.propertyName;
    }
    setPropertyName(propertyName) {
        this.propertyName = propertyName;
    }
    isOptional() {
        return this.optional;
    }
    setOptional(optional) {
        this.optional = optional;
    }
}
class ArrayBindingPatternParameter {
    constructor() {
        this.propertyName = "";
        this.name = "";
        this.optional = false;
        this.initializer = "";
    }
    getName() {
        return this.name;
    }
    setName(name) {
        this.name = name;
    }
    getPropertyName() {
        return this.propertyName;
    }
    setPropertyName(propertyName) {
        this.propertyName = propertyName;
    }
    isOptional() {
        return this.optional;
    }
    setOptional(optional) {
        this.optional = optional;
    }
}
class MethodParameter {
    constructor() {
        this.name = "";
        this.optional = false;
        this.objElements = [];
        this.arrayElements = [];
    }
    getName() {
        return this.name;
    }
    setName(name) {
        this.name = name;
    }
    getType() {
        return this.type;
    }
    setType(type) {
        this.type = type;
    }
    isOptional() {
        return this.optional;
    }
    setOptional(optional) {
        this.optional = optional;
    }
    addObjElement(element) {
        this.objElements.push(element);
    }
    getObjElements() {
        return this.objElements;
    }
    setObjElements(objElements) {
        this.objElements = objElements;
    }
    addArrayElement(element) {
        this.arrayElements.push(element);
    }
    getArrayElements() {
        return this.arrayElements;
    }
    setArrayElements(arrayElements) {
        this.arrayElements = arrayElements;
    }
}
class MethodInfo {
    constructor(name, parameters, modifiers, returnType, typeParameters, getAccessorName) {
        this.getAccessorName = undefined;
        this.name = name;
        this.parameters = parameters;
        this.modifiers = modifiers;
        this.returnType = returnType;
        this.typeParameters = typeParameters;
        this.getAccessorName = getAccessorName;
    }
    updateName4anonymousFunc(newName) {
        this.name = newName;
    }
}
//get function name, parameters, return type, etc.
function buildMethodInfo4MethodNode(node, sourceFile) {
    //TODO: consider function without name
    let name = '';
    let getAccessorName = undefined;
    if (ts.isFunctionDeclaration(node)) {
        name = node.name ? node.name.text : '';
    }
    else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
        if (ts.isIdentifier(node.name)) {
            name = node.name.text;
        }
        else if (ts.isComputedPropertyName(node.name)) {
            if (ts.isPropertyAccessExpression(node.name.expression)) {
                name = handlePropertyAccessExpression(node.name.expression);
            }
        }
        else {
            logger$d.warn("Other method declaration type found!");
        }
    }
    //TODO, hard code
    else if (ts.isConstructorDeclaration(node)) {
        name = 'constructor';
    }
    else if (ts.isConstructSignatureDeclaration(node)) {
        name = 'construct-signature';
    }
    else if (ts.isCallSignatureDeclaration(node)) {
        name = "call-signature";
    }
    else if (ts.isGetAccessor(node) && ts.isIdentifier(node.name)) {
        name = 'Get-' + node.name.text;
        getAccessorName = node.name.text;
    }
    else if (ts.isSetAccessor(node) && ts.isIdentifier(node.name)) {
        name = 'Set-' + node.name.text;
    }
    let parameterTypes = buildParameters(node, sourceFile);
    //TODO: remember to test abstract method
    let modifiers = new Set();
    if ((!ts.isConstructSignatureDeclaration(node)) && (!ts.isCallSignatureDeclaration(node))) {
        if (node.modifiers) {
            modifiers = buildModifiers(node.modifiers);
        }
    }
    let returnType = buildReturnType4Method(node, sourceFile);
    let typeParameters = buildTypeParameters(node);
    return new MethodInfo(name, parameterTypes, modifiers, returnType, typeParameters, getAccessorName);
}

class Constant {
    constructor(value, type = UnknownType.getInstance()) {
        this.value = value;
        this.type = type;
    }
    getValue() {
        return this.value;
    }
    setValue(newValue) {
        this.value = newValue;
    }
    getUses() {
        return [];
    }
    getType() {
        return this.type;
    }
    setType(newType) {
        this.type = newType;
    }
    toString() {
        return this.value;
    }
}

const logger$c = ConsoleLogger.getLogger();
function handleQualifiedName(node) {
    let right = node.right.text;
    let left = '';
    if (ts__default.SyntaxKind[node.left.kind] == 'Identifier') {
        left = node.left.text;
    }
    else if (ts__default.SyntaxKind[node.left.kind] == 'QualifiedName') {
        left = handleQualifiedName(node.left);
    }
    let qualifiedName = left + '.' + right;
    return qualifiedName;
}
function handlePropertyAccessExpression(node) {
    let right = node.name.text;
    let left = '';
    if (ts__default.SyntaxKind[node.expression.kind] == 'Identifier') {
        left = node.expression.text;
    }
    else if (ts__default.isStringLiteral(node.expression)) {
        left = node.expression.text;
    }
    else if (ts__default.isPropertyAccessExpression(node.expression)) {
        left = handlePropertyAccessExpression(node.expression);
    }
    let propertyAccessExpressionName = left + '.' + right;
    return propertyAccessExpressionName;
}
function buildModifiers(modifierArray) {
    let modifiers = new Set();
    modifierArray.forEach((modifier) => {
        //TODO: find reason!!
        if (ts__default.SyntaxKind[modifier.kind] == 'FirstContextualKeyword') {
            modifiers.add('AbstractKeyword');
        }
        else if (ts__default.isDecorator(modifier)) {
            if (modifier.expression) {
                if (ts__default.isIdentifier(modifier.expression)) {
                    modifiers.add(modifier.expression.text);
                }
                else if (ts__default.isCallExpression(modifier.expression)) {
                    if (ts__default.isIdentifier(modifier.expression.expression)) {
                        modifiers.add(modifier.expression.expression.text);
                    }
                }
            }
        }
        else {
            modifiers.add(ts__default.SyntaxKind[modifier.kind]);
        }
    });
    return modifiers;
}
function buildHeritageClauses(node) {
    var _a;
    let heritageClausesMap = new Map();
    (_a = node.heritageClauses) === null || _a === void 0 ? void 0 : _a.forEach((heritageClause) => {
        heritageClause.types.forEach((type) => {
            let heritageClauseName = '';
            if (ts__default.isIdentifier(type.expression)) {
                heritageClauseName = type.expression.text;
            }
            else if (ts__default.isPropertyAccessExpression(type.expression)) {
                heritageClauseName = handlePropertyAccessExpression(type.expression);
            }
            else {
                logger$c.warn("Other type expression found!!!");
            }
            heritageClausesMap.set(heritageClauseName, ts__default.SyntaxKind[heritageClause.token]);
        });
    });
    return heritageClausesMap;
}
function buildTypeParameters(node) {
    var _a;
    let typeParameters = [];
    (_a = node.typeParameters) === null || _a === void 0 ? void 0 : _a.forEach((typeParameter) => {
        if (ts__default.isIdentifier(typeParameter.name)) {
            let parametersTypeStr = typeParameter.name.text;
            typeParameters.push(buildTypeFromPreStr(parametersTypeStr));
        }
        else {
            logger$c.warn("Other typeparameter found!!!");
        }
    });
    return typeParameters;
}
function buildParameters(node, sourceFile) {
    let parameters = [];
    node.parameters.forEach((parameter) => {
        let methodParameter = new MethodParameter();
        if (ts__default.isIdentifier(parameter.name)) {
            methodParameter.setName(parameter.name.text);
        }
        else if (ts__default.isObjectBindingPattern(parameter.name)) {
            methodParameter.setName("ObjectBindingPattern");
            let elements = [];
            parameter.name.elements.forEach((element) => {
                let paraElement = new ObjectBindingPatternParameter();
                if (element.propertyName) {
                    if (ts__default.isIdentifier(element.propertyName)) {
                        paraElement.setPropertyName(element.propertyName.text);
                    }
                    else {
                        logger$c.warn("New propertyName of ObjectBindingPattern found, please contact developers to support this!");
                    }
                }
                if (element.name) {
                    if (ts__default.isIdentifier(element.name)) {
                        paraElement.setName(element.name.text);
                    }
                    else {
                        logger$c.warn("New name of ObjectBindingPattern found, please contact developers to support this!");
                    }
                }
                if (element.initializer) {
                    logger$c.warn("TODO: support ObjectBindingPattern initializer.");
                }
                if (element.dotDotDotToken) {
                    paraElement.setOptional(true);
                }
                elements.push(paraElement);
            });
            methodParameter.setObjElements(elements);
        }
        else if (ts__default.isArrayBindingPattern(parameter.name)) {
            methodParameter.setName("ArrayBindingPattern");
            let elements = [];
            parameter.name.elements.forEach((element) => {
                let paraElement = new ArrayBindingPatternParameter();
                if (ts__default.isBindingElement(element)) {
                    if (element.propertyName) {
                        if (ts__default.isIdentifier(element.propertyName)) {
                            paraElement.setPropertyName(element.propertyName.text);
                        }
                        else {
                            logger$c.warn("New propertyName of ArrayBindingPattern found, please contact developers to support this!");
                        }
                    }
                    if (element.name) {
                        if (ts__default.isIdentifier(element.name)) {
                            paraElement.setName(element.name.text);
                        }
                        else {
                            logger$c.warn("New name of ArrayBindingPattern found, please contact developers to support this!");
                        }
                    }
                    if (element.initializer) {
                        logger$c.warn("TODO: support ArrayBindingPattern initializer.");
                    }
                    if (element.dotDotDotToken) {
                        paraElement.setOptional(true);
                    }
                }
                else if (ts__default.isOmittedExpression(element)) {
                    logger$c.warn("TODO: support OmittedExpression for ArrayBindingPattern parameter name.");
                }
                elements.push(paraElement);
            });
            methodParameter.setArrayElements(elements);
        }
        else {
            logger$c.warn("Parameter name is not identifier, please contact developers to support this!");
        }
        if (parameter.questionToken) {
            methodParameter.setOptional(true);
        }
        if (parameter.type) {
            if (ts__default.isTypeReferenceNode(parameter.type)) {
                let referenceNodeName = parameter.type.typeName;
                if (ts__default.isQualifiedName(referenceNodeName)) {
                    let parameterTypeStr = handleQualifiedName(referenceNodeName);
                    let parameterType = new UnclearReferenceType(parameterTypeStr);
                    methodParameter.setType(parameterType);
                }
                else if (ts__default.isIdentifier(referenceNodeName)) {
                    let parameterTypeStr = referenceNodeName.text;
                    let parameterType = new UnclearReferenceType(parameterTypeStr);
                    methodParameter.setType(parameterType);
                }
            }
            else if (ts__default.isUnionTypeNode(parameter.type)) {
                let unionTypePara = [];
                parameter.type.types.forEach((tmpType) => {
                    if (ts__default.isTypeReferenceNode(tmpType)) {
                        let parameterType = "";
                        if (ts__default.isQualifiedName(tmpType.typeName)) {
                            parameterType = handleQualifiedName(tmpType.typeName);
                        }
                        else if (ts__default.isIdentifier(tmpType.typeName)) {
                            parameterType = tmpType.typeName.text;
                        }
                        unionTypePara.push(new UnclearReferenceType(parameterType));
                    }
                    else if (ts__default.isLiteralTypeNode(tmpType)) {
                        unionTypePara.push(buildTypeFromPreStr(ts__default.SyntaxKind[tmpType.literal.kind]));
                    }
                    else {
                        unionTypePara.push(buildTypeFromPreStr(ts__default.SyntaxKind[tmpType.kind]));
                    }
                });
                methodParameter.setType(new UnionType(unionTypePara));
            }
            else if (ts__default.isLiteralTypeNode(parameter.type)) {
                methodParameter.setType(buildTypeFromPreStr(ts__default.SyntaxKind[parameter.type.literal.kind]));
            }
            else if (ts__default.isTypeLiteralNode(parameter.type)) {
                let members = [];
                parameter.type.members.forEach((member) => {
                    if (ts__default.isPropertySignature(member)) {
                        members.push(buildProperty2ArkField(member, sourceFile));
                    }
                    else if (ts__default.isIndexSignatureDeclaration(member)) {
                        members.push(buildIndexSignature2ArkField(member, sourceFile));
                    }
                    else if (ts__default.isConstructSignatureDeclaration(member)) ;
                    else if (ts__default.isCallSignatureDeclaration(member)) ;
                    else {
                        logger$c.warn("Please contact developers to support new TypeLiteral member!");
                    }
                });
                let type = new TypeLiteralType();
                type.setMembers(members);
                methodParameter.setType(type);
            }
            else if (ts__default.isFunctionTypeNode(parameter.type)) {
                //Bug, To be fixed
                //members.push(buildMethodInfo4MethodNode(member));
                methodParameter.setType(buildTypeFromPreStr(ts__default.SyntaxKind[parameter.type.kind]));
            }
            else {
                methodParameter.setType(buildTypeFromPreStr(ts__default.SyntaxKind[parameter.type.kind]));
            }
        }
        else {
            methodParameter.setType(UnknownType.getInstance());
        }
        parameters.push(methodParameter);
    });
    return parameters;
}
function buildReturnType4Method(node, sourceFile) {
    if (node.type) {
        if (ts__default.isTypeLiteralNode(node.type)) {
            let members = [];
            node.type.members.forEach((member) => {
                if (ts__default.isPropertySignature(member)) {
                    members.push(buildProperty2ArkField(member, sourceFile));
                }
                else if (ts__default.isIndexSignatureDeclaration(member)) {
                    members.push(buildIndexSignature2ArkField(member, sourceFile));
                }
                else {
                    logger$c.warn("Please contact developers to support new TypeLiteral member!");
                }
            });
            let type = new TypeLiteralType();
            type.setMembers(members);
            return type;
        }
        else if (ts__default.isTypeReferenceNode(node.type)) {
            let referenceNodeName = node.type.typeName;
            let typeName = "";
            if (ts__default.isQualifiedName(referenceNodeName)) {
                typeName = handleQualifiedName(referenceNodeName);
            }
            else if (ts__default.isIdentifier(referenceNodeName)) {
                typeName = referenceNodeName.text;
            }
            else {
                logger$c.warn("New type of referenceNodeName found! Please contact developers to support this.");
            }
            return new UnclearReferenceType(typeName);
        }
        else if (ts__default.isUnionTypeNode(node.type)) {
            let unionType = [];
            node.type.types.forEach((tmpType) => {
                if (ts__default.isTypeReferenceNode(tmpType)) {
                    let typeName = "";
                    if (ts__default.isIdentifier(tmpType.typeName)) {
                        typeName = tmpType.typeName.text;
                    }
                    else if (ts__default.isQualifiedName(tmpType.typeName)) {
                        typeName = handleQualifiedName(tmpType.typeName);
                    }
                    else if (ts__default.isTypeLiteralNode(tmpType.typeName)) {
                        logger$c.warn("Type name is TypeLiteral, please contact developers to add support for this!");
                    }
                    else {
                        logger$c.warn("New type name of TypeReference in UnionType.");
                    }
                    unionType.push(new UnclearReferenceType(typeName));
                }
                else if (ts__default.isLiteralTypeNode(tmpType)) {
                    let literalType = new LiteralType(ts__default.SyntaxKind[tmpType.literal.kind]);
                    unionType.push(literalType);
                }
                else {
                    unionType.push(buildTypeFromPreStr(ts__default.SyntaxKind[tmpType.kind]));
                }
            });
            return unionType;
        }
        else if (ts__default.isLiteralTypeNode(node.type)) {
            let literalType = new LiteralType(ts__default.SyntaxKind[node.type.literal.kind]);
            return literalType;
        }
        else {
            return buildTypeFromPreStr(ts__default.SyntaxKind[node.type.kind]);
        }
    }
    return new UnknownType();
}
function buildTypeFromPreStr(preStr) {
    let postStr = "";
    switch (preStr) {
        case 'BooleanKeyword':
            postStr = "boolean";
            break;
        case 'FalseKeyword':
            postStr = "boolean";
            break;
        case 'TrueKeyword':
            postStr = "boolean";
            break;
        case 'NumberKeyword':
            postStr = "number";
            break;
        case 'NumericLiteral':
            postStr = "number";
            break;
        case 'FirstLiteralToken':
            postStr = "number";
            break;
        case 'StringKeyword':
            postStr = "string";
            break;
        case 'StringLiteral':
            postStr = "string";
            break;
        case 'UndefinedKeyword':
            postStr = "undefined";
            break;
        case 'NullKeyword':
            postStr = "null";
            break;
        case 'AnyKeyword':
            postStr = "any";
            break;
        case 'VoidKeyword':
            postStr = "void";
            break;
        case 'NeverKeyword':
            postStr = "never";
            break;
        default:
            postStr = preStr;
    }
    return TypeInference.buildTypeFromStr(postStr);
}
function buildProperty2ArkField(member, sourceFile) {
    let field = new ArkField();
    field.setFieldType(ts__default.SyntaxKind[member.kind]);
    field.setOriginPosition(LineColPosition.buildFromNode(member, sourceFile));
    // construct initializer
    if (ts__default.isPropertyDeclaration(member) || ts__default.isEnumMember(member)) {
        if (member.initializer) {
            field.setInitializer(tsNode2Value(member.initializer, sourceFile));
        }
    }
    if (ts__default.isShorthandPropertyAssignment(member)) {
        if (member.objectAssignmentInitializer) {
            field.setInitializer(tsNode2Value(member.objectAssignmentInitializer, sourceFile));
        }
    }
    if (ts__default.isSpreadAssignment(member)) {
        field.setInitializer(tsNode2Value(member.expression, sourceFile));
    }
    if (member.name && ts__default.isComputedPropertyName(member.name)) {
        if (ts__default.isIdentifier(member.name.expression)) {
            let propertyName = member.name.expression.text;
            field.setName(propertyName);
        }
        else if (ts__default.isPropertyAccessExpression(member.name.expression)) {
            field.setName(handlePropertyAccessExpression(member.name.expression));
        }
        else {
            logger$c.warn("Other property expression type found!");
        }
    }
    else if (member.name && ts__default.isIdentifier(member.name)) {
        let propertyName = member.name.text;
        field.setName(propertyName);
    }
    else {
        logger$c.warn("Other property type found!");
    }
    if ((ts__default.isPropertyDeclaration(member) || ts__default.isPropertySignature(member)) && member.modifiers) {
        let modifiers = buildModifiers(member.modifiers);
        modifiers.forEach((modifier) => {
            field.addModifier(modifier);
        });
    }
    if ((ts__default.isPropertyDeclaration(member) || ts__default.isPropertySignature(member)) && member.type) {
        field.setType(buildFieldType(member.type));
    }
    if ((ts__default.isPropertyDeclaration(member) || ts__default.isPropertySignature(member)) && member.questionToken) {
        field.setQuestionToken(true);
    }
    if (ts__default.isPropertyDeclaration(member) && member.exclamationToken) {
        field.setExclamationToken(true);
    }
    return field;
}
function buildIndexSignature2ArkField(member, sourceFile) {
    let field = new ArkField();
    field.setFieldType(ts__default.SyntaxKind[member.kind]);
    //parameters
    field.setParameters(buildParameters(member, sourceFile));
    field.setOriginPosition(LineColPosition.buildFromNode(member, sourceFile));
    //modifiers
    if (member.modifiers) {
        buildModifiers(member.modifiers).forEach((modifier) => {
            field.addModifier(modifier);
        });
    }
    //type
    field.setType(buildReturnType4Method(member, sourceFile));
    return field;
}
function buildGetAccessor2ArkField(member, sourceFile) {
    let field = new ArkField();
    if (ts__default.isIdentifier(member.name)) {
        field.setName(member.name.text);
    }
    else {
        logger$c.warn("Please contact developers to support new type of GetAccessor name!");
        field.setName('');
    }
    field.setFieldType(ts__default.SyntaxKind[member.kind]);
    field.setOriginPosition(LineColPosition.buildFromNode(member, sourceFile));
    return field;
}
function buildFieldType(fieldType) {
    if (ts__default.isUnionTypeNode(fieldType)) {
        let unionType = [];
        fieldType.types.forEach((tmpType) => {
            if (ts__default.isTypeReferenceNode(tmpType)) {
                let tmpTypeName = "";
                if (ts__default.isQualifiedName(tmpType.typeName)) {
                    tmpTypeName = handleQualifiedName(tmpType.typeName);
                }
                else if (ts__default.isIdentifier(tmpType.typeName)) {
                    tmpTypeName = tmpType.typeName.text;
                }
                else {
                    logger$c.warn("Other property type found!");
                }
                unionType.push(new UnclearReferenceType(tmpTypeName));
            }
            else if (ts__default.isLiteralTypeNode(tmpType)) {
                unionType.push(buildTypeFromPreStr(ts__default.SyntaxKind[tmpType.literal.kind]));
            }
            else {
                unionType.push(buildTypeFromPreStr(ts__default.SyntaxKind[tmpType.kind]));
            }
        });
        return unionType;
    }
    else if (ts__default.isTypeReferenceNode(fieldType)) {
        let tmpTypeName = "";
        let referenceNodeName = fieldType.typeName;
        if (ts__default.isQualifiedName(referenceNodeName)) {
            tmpTypeName = handleQualifiedName(referenceNodeName);
        }
        else if (ts__default.isIdentifier(referenceNodeName)) {
            tmpTypeName = referenceNodeName.text;
        }
        return new UnclearReferenceType(tmpTypeName);
    }
    else if (ts__default.isLiteralTypeNode(fieldType)) {
        return buildTypeFromPreStr(ts__default.SyntaxKind[fieldType.literal.kind]);
    }
    else {
        return buildTypeFromPreStr(ts__default.SyntaxKind[fieldType.kind]);
    }
}
function tsNode2Value(node, sourceFile) {
    var _a, _b;
    let nodeKind = ts__default.SyntaxKind[node.kind];
    if (nodeKind == 'NumericLiteral' ||
        nodeKind == 'StringLiteral' ||
        nodeKind == 'TrueKeyword' ||
        nodeKind == 'FalseKeyword' ||
        nodeKind == 'FirstLiteralToken') {
        let type = buildTypeFromPreStr(nodeKind);
        let value = node.getText(sourceFile);
        return new Constant(value, type);
    }
    else if (ts__default.isNewExpression(node)) {
        if (ts__default.isIdentifier(node.expression)) {
            let className = node.expression.escapedText.toString();
            let tmpTypes = [];
            (_a = node.typeArguments) === null || _a === void 0 ? void 0 : _a.forEach((type) => {
                tmpTypes.push(buildTypeFromPreStr(ts__default.SyntaxKind[type.kind]));
            });
            let typeArguments = new UnionType(tmpTypes);
            let arrayArguments = [];
            (_b = node.arguments) === null || _b === void 0 ? void 0 : _b.forEach((argument) => {
                let value = argument.getText(sourceFile);
                let type = AnyType.getInstance();
                if (ts__default.SyntaxKind[argument.kind] != 'Identifier') {
                    type = buildTypeFromPreStr(ts__default.SyntaxKind[argument.kind]);
                }
                arrayArguments.push(new Constant(value, type));
            });
            if (className === 'Array') {
                if (arrayArguments.length == 1 && (arrayArguments[0].getType() instanceof NumberType)) {
                    return new ArkNewArrayExpr(typeArguments, arrayArguments[0]);
                }
                else if (arrayArguments.length == 1 && !(arrayArguments[0].getType() instanceof NumberType)) {
                    //TODO, Local number or others
                    logger$c.warn("TODO, Local number or others.");
                }
                else if (arrayArguments.length > 1) {
                    let newArrayExpr = new ArkNewArrayExpr(typeArguments, new Constant(arrayArguments.length.toString(), NumberType.getInstance()));
                    //TODO: add each value for this array
                    logger$c.warn("TODO, Local number or others.");
                    return newArrayExpr;
                }
            }
            else {
                let classSignature = new ClassSignature();
                classSignature.setClassName(className);
                const classType = new ClassType(classSignature);
                return new ArkNewExpr(classType);
            }
        }
        else {
            logger$c.warn("Other newExpr type found for ts node.");
        }
    }
    else if (ts__default.isArrayLiteralExpression(node)) {
        let elements = [];
        node.elements.forEach((element) => {
            let value = tsNode2Value(element, sourceFile);
            if (value == undefined) {
                elements.push(new Constant('', buildTypeFromPreStr('UndefinedKeyword')));
            }
            else {
                elements.push(value);
            }
        });
        let types = [];
        elements.forEach((element) => {
            types.push(element.getType());
        });
        let type = new UnionType(types);
        return new ArrayLiteralExpr(elements, type);
    }
    else if (ts__default.isBinaryExpression(node)) {
        let leftOp = tsNode2Value(node.left, sourceFile);
        let rightOp = tsNode2Value(node.right, sourceFile);
        let op = ts__default.SyntaxKind[node.operatorToken.kind];
        return new ArkBinopExpr(leftOp, rightOp, op);
    }
    else if (ts__default.isPrefixUnaryExpression(node)) {
        let op = ts__default.SyntaxKind[node.operator];
        let value = tsNode2Value(node.operand, sourceFile);
        return new ArkUnopExpr(value, op);
    }
    else if (ts__default.isIdentifier(node)) {
        let name = node.escapedText.toString();
        return new Local(name);
    }
    else if (ts__default.isPropertyAccessExpression(node)) {
        let fieldName = node.name.escapedText.toString();
        const fieldSignature = new FieldSignature();
        fieldSignature.setFieldName(fieldName);
        let base = tsNode2Value(node.expression, sourceFile);
        //TODO: support question token?
        return new ArkInstanceFieldRef(base, fieldSignature);
    }
    else if (ts__default.isCallExpression(node)) {
        let exprValue = tsNode2Value(node.expression, sourceFile);
        let argumentParas = [];
        node.arguments.forEach((argument) => {
            argumentParas.push(tsNode2Value(argument, sourceFile));
        });
        //TODO: support typeArguments
        let classSignature = new ClassSignature();
        let methodSubSignature = new MethodSubSignature();
        let methodSignature = new MethodSignature();
        methodSignature.setDeclaringClassSignature(classSignature);
        methodSignature.setMethodSubSignature(methodSubSignature);
        if (exprValue instanceof ArkInstanceFieldRef) {
            let methodName = exprValue.getFieldName();
            let base = exprValue.getBase();
            methodSubSignature.setMethodName(methodName);
            return new ArkInstanceInvokeExpr(base, methodSignature, argumentParas);
        }
        else if (exprValue instanceof ArkStaticFieldRef) {
            methodSubSignature.setMethodName(exprValue.getFieldName());
            return new ArkStaticInvokeExpr(methodSignature, argumentParas);
        }
        else {
            methodSubSignature.setMethodName(node.getText(sourceFile));
            return new ArkStaticInvokeExpr(methodSignature, argumentParas);
        }
    }
    else if (ts__default.isObjectLiteralExpression(node)) {
        let anonymousClassName = 'AnonymousClass-initializer';
        // TODO: 解析类体
        let arkClass = new ArkClass();
        arkClass.setName(anonymousClassName);
        const { line, character } = ts__default.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        arkClass.setLine(line + 1);
        arkClass.setColumn(character + 1);
        let classSig = new ClassSignature();
        classSig.setClassName(arkClass.getName());
        const classType = new ClassType(classSig);
        //gen arkfields
        let arkFields = [];
        let arkMethods = [];
        node.properties.forEach((property) => {
            if (ts__default.isPropertyAssignment(property) || ts__default.isShorthandPropertyAssignment(property) || ts__default.isSpreadAssignment(property)) {
                arkFields.push(buildProperty2ArkField(property, sourceFile));
            }
            else {
                let methodInfo = buildMethodInfo4MethodNode(property, sourceFile);
                let arkMethod = new ArkMethod();
                const { line, character } = ts__default.getLineAndCharacterOfPosition(sourceFile, property.getStart(sourceFile));
                arkMethod.setLine(line + 1);
                arkMethod.setColumn(character + 1);
                buildNormalArkMethodFromMethodInfo(methodInfo, arkMethod);
                arkMethods.push(arkMethod);
            }
        });
        arkMethods.forEach((mtd) => {
            arkClass.addMethod(mtd);
        });
        return new ObjectLiteralExpr(arkClass, classType);
    }
    else {
        logger$c.warn("Other type found for ts node.");
    }
    return new Constant('', UnknownType.getInstance());
}

const logger$b = ConsoleLogger.getLogger();
class ClassInfo {
    constructor() {
        this.modifiers = new Set();
        this.className = "";
        this.typeParameters = [];
        this.heritageClauses = new Map();
        this.originType = "";
        this.members = [];
    }
    build(modifiers, className, typeParameters, heritageClauses, members, originType) {
        this.modifiers = modifiers;
        this.className = className;
        this.typeParameters = typeParameters;
        this.heritageClauses = heritageClauses;
        this.members = members;
        this.originType = originType;
    }
    getClassName() {
        return this.className;
    }
    setClassName(className) {
        this.className = className;
    }
    getmodifiers() {
        return this.modifiers;
    }
    setmodifiers(modifiers) {
        this.modifiers = modifiers;
    }
    getTypeParameters() {
        return this.typeParameters;
    }
    setTypeParameters(typeParameters) {
        this.typeParameters = typeParameters;
    }
    getHeritageClauses() {
        return this.heritageClauses;
    }
    setHeritageClauses(heritageClauses) {
        this.heritageClauses = heritageClauses;
    }
    getOriginType() {
        return this.originType;
    }
    setOriginType(originType) {
        this.originType = originType;
    }
    getMembers() {
        return this.members;
    }
    setMembers(members) {
        this.members = members;
    }
}
function buildClassInfo4ClassNode(node, sourceFile) {
    let originType = "";
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        originType = "Class";
    }
    else if (ts.isInterfaceDeclaration(node)) {
        originType = "Interface";
    }
    else {
        originType = "Enum";
    }
    let modifiers = new Set();
    if (node.modifiers) {
        modifiers = buildModifiers(node.modifiers);
    }
    let name = node.name ? node.name.text : '';
    let typeParameters = [];
    if (!ts.isEnumDeclaration(node)) {
        typeParameters = buildTypeParameters(node);
    }
    let heritageClauses = new Map();
    if (!ts.isEnumDeclaration(node)) {
        heritageClauses = buildHeritageClauses(node);
    }
    let members = [];
    node.members.forEach((member) => {
        if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member) || ts.isEnumMember(member)) {
            members.push(buildProperty2ArkField(member, sourceFile));
        }
        else if (ts.isIndexSignatureDeclaration(member)) {
            members.push(buildIndexSignature2ArkField(member, sourceFile));
        }
        else if (ts.isGetAccessor(member)) {
            members.push(buildGetAccessor2ArkField(member, sourceFile));
        }
        else if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member) || ts.isMethodSignature(member) ||
            ts.isConstructSignatureDeclaration(member) || ts.isSetAccessor(member) || ts.isCallSignatureDeclaration(member)
            || ts.isSemicolonClassElement(member)) ;
        else {
            logger$b.warn("Please contact developers to support new arkfield type!");
        }
    });
    let classInfo = new ClassInfo();
    classInfo.build(modifiers, name, typeParameters, heritageClauses, members, originType);
    return classInfo;
}

var sdkPathMap = new Map();
function updateSdkConfigPrefix(sdkName, sdkRelativePath) {
    sdkPathMap.set(sdkName, transfer2UnixPath(sdkRelativePath));
}
class ImportInfo {
    constructor() {
        this.clauseType = "";
        this.importFromSignature2Str = "";
        this.importProjectType = "ThirdPartPackage";
    }
    build(importClauseName, importType, importFrom, nameBeforeAs) {
        this.setImportClauseName(importClauseName);
        this.setImportType(importType);
        this.setImportFrom(importFrom);
        this.setNameBeforeAs(nameBeforeAs);
    }
    getImportFromSignature2Str() {
        return this.importFromSignature2Str;
    }
    getImportProjectType() {
        return this.importProjectType;
    }
    setImportProjectType(importProjectType) {
        this.importProjectType = importProjectType;
    }
    setDeclaringFilePath(declaringFilePath) {
        this.declaringFilePath = declaringFilePath;
    }
    setDeclaringArkFile(declaringArkFile) {
        this.declaringArkFile = declaringArkFile;
    }
    setProjectPath(projectPath) {
        this.projectPath = projectPath;
    }
    setImportFromSignature() {
        let importFromSignature = new FileSignature();
        // project internal imports
        const pathReg1 = new RegExp("^(\\.\\.\\/\|\\.\\/)");
        if (pathReg1.test(this.importFrom)) {
            this.setImportProjectType("TargetProject");
            //get real target path of importfrom
            let realImportFromPath = path.resolve(path.dirname(this.declaringFilePath), this.importFrom);
            //get relative path from project dir to real target path of importfrom
            let tmpSig1 = path.relative(this.projectPath, realImportFromPath);
            //tmpSig1 = tmpSig1.replace(/^\.\//, '');
            importFromSignature.setFileName(tmpSig1);
            importFromSignature.setProjectName(this.declaringArkFile.getProjectName());
            this.importFromSignature2Str = importFromSignature.toString();
        }
        // external imports, e.g. @ohos., @kit., @System., @ArkAnalyzer/
        sdkPathMap.forEach((value, key) => {
            // e.g. @ohos., @kit., @System.
            if (key == 'ohos' || key == 'kit' || key == 'system') {
                const pathReg2 = new RegExp(`@(${key})\\.`);
                if (pathReg2.test(this.importFrom)) {
                    this.setImportProjectType("SDKProject");
                    let tmpSig = '@' + key + '/' + this.importFrom + ': ';
                    this.importFromSignature2Str = tmpSig;
                }
            }
            // e.g. @ArkAnalyzer/
            else {
                const pathReg3 = new RegExp(`@(${key})\\/`);
                if (pathReg3.test(this.importFrom)) {
                    this.setImportProjectType("SDKProject");
                    this.importFromSignature2Str = this.importFrom + ': ';
                }
            }
        });
        //third part npm package
        //TODO
    }
    getImportClauseName() {
        return this.importClauseName;
    }
    setImportClauseName(importClauseName) {
        this.importClauseName = importClauseName;
    }
    getImportType() {
        return this.importType;
    }
    setImportType(importType) {
        this.importType = importType;
    }
    getImportFrom() {
        return this.importFrom;
    }
    setImportFrom(importFrom) {
        this.importFrom = importFrom;
    }
    getNameBeforeAs() {
        return this.nameBeforeAs;
    }
    setNameBeforeAs(nameBeforeAs) {
        this.nameBeforeAs = nameBeforeAs;
    }
    getClauseType() {
        return this.clauseType;
    }
    setClauseType(clauseType) {
        this.clauseType = clauseType;
    }
    transfer2UnixPath(path2Do) {
        return path.posix.join(...path2Do.split(/\\/));
    }
}
function buildImportInfo4ImportNode(node) {
    if (ts.isImportDeclaration(node)) {
        return buildImportDeclarationNode(node);
    }
    else {
        return buildImportEqualsDeclarationNode(node);
    }
}
function buildImportDeclarationNode(node) {
    let importInfos = [];
    let importFrom = '';
    if (ts.isStringLiteral(node.moduleSpecifier)) {
        importFrom = node.moduleSpecifier.text;
    }
    // just like: import '../xxx'
    if (!node.importClause) {
        let importClauseName = '';
        let importType = '';
        let importInfo = new ImportInfo();
        importInfo.build(importClauseName, importType, importFrom);
        importInfos.push(importInfo);
    }
    //just like: import fs from 'fs'
    if (node.importClause && node.importClause.name && ts.isIdentifier(node.importClause.name)) {
        let importClauseName = node.importClause.name.text;
        let importType = "Identifier";
        let importInfo = new ImportInfo();
        importInfo.build(importClauseName, importType, importFrom);
        importInfos.push(importInfo);
    }
    // just like: import {xxx} from './yyy'
    if (node.importClause && node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        let importType = "NamedImports";
        if (node.importClause.namedBindings.elements) {
            node.importClause.namedBindings.elements.forEach((element) => {
                if (element.name && ts.isIdentifier(element.name)) {
                    let importClauseName = element.name.text;
                    if (element.propertyName && ts.isIdentifier(element.propertyName)) {
                        let importInfo = new ImportInfo();
                        importInfo.build(importClauseName, importType, importFrom, element.propertyName.text);
                        importInfos.push(importInfo);
                    }
                    else {
                        let importInfo = new ImportInfo();
                        importInfo.build(importClauseName, importType, importFrom);
                        importInfos.push(importInfo);
                    }
                }
            });
        }
    }
    // just like: import * as ts from 'typescript'
    if (node.importClause && node.importClause.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) {
        let importType = "NamespaceImport";
        if (node.importClause.namedBindings.name && ts.isIdentifier(node.importClause.namedBindings.name)) {
            let importClauseName = node.importClause.namedBindings.name.text;
            let importInfo = new ImportInfo();
            let nameBeforeAs = '*';
            importInfo.build(importClauseName, importType, importFrom, nameBeforeAs);
            importInfos.push(importInfo);
        }
    }
    return importInfos;
}
function buildImportEqualsDeclarationNode(node) {
    let importInfos = [];
    let importType = "EqualsImport";
    if (node.moduleReference && ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
        let importFrom = node.moduleReference.expression.text;
        let importClauseName = node.name.text;
        let importInfo = new ImportInfo();
        importInfo.build(importClauseName, importType, importFrom);
        importInfos.push(importInfo);
    }
    return importInfos;
}

class ExportInfo {
    constructor() {
        this.isDefault = false;
    }
    build(exportClauseName, exportClauseType, exportFrom, nameBeforeAs) {
        this.setExportClauseName(exportClauseName);
        this.setExportClauseType(exportClauseType);
        this.setExportFrom(exportFrom);
        this.setNameBeforeAs(nameBeforeAs);
        this.genImportInfo();
    }
    getExportClauseName() {
        return this.exportClauseName;
    }
    setExportClauseName(exportClauseName) {
        this.exportClauseName = exportClauseName;
    }
    getExportClauseType() {
        return this.exportClauseType;
    }
    setExportClauseType(exportClauseType) {
        this.exportClauseType = exportClauseType;
    }
    getExportFrom() {
        return this.exportFrom;
    }
    setExportFrom(exportFrom) {
        this.exportFrom = exportFrom;
    }
    getNameBeforeAs() {
        return this.nameBeforeAs;
    }
    setNameBeforeAs(nameBeforeAs) {
        this.nameBeforeAs = nameBeforeAs;
    }
    setDefault(isDefault) {
        this.isDefault = isDefault;
    }
    getDefault() {
        return this.isDefault;
    }
    setImportInfo(importInfo) {
        this.importInfo = importInfo;
    }
    getImportInfo() {
        return this.importInfo;
    }
    genImportInfo() {
        if (this.exportFrom != undefined) {
            let importInfo = new ImportInfo();
            importInfo.build(this.exportClauseName, this.exportClauseType, this.exportFrom, this.nameBeforeAs);
            this.setImportInfo(importInfo);
        }
    }
}
function buildExportInfo4ExportNode(node) {
    if (ts.isExportDeclaration(node)) {
        return buildExportDeclarationNode(node);
    }
    else {
        return buildExportAssignmentNode(node);
    }
}
function buildExportDeclarationNode(node) {
    let exportInfos = [];
    let exportFrom;
    if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        exportFrom = node.moduleSpecifier.text;
    }
    // just like: export {xxx as x} from './yy'
    if (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements) {
        let exportClauseType = "NamedExports";
        node.exportClause.elements.forEach((element) => {
            let exportClauseName = element.name.text;
            if (element.propertyName && ts.isIdentifier(element.propertyName)) {
                let exportInfo = new ExportInfo();
                exportInfo.build(exportClauseName, exportClauseType, exportFrom, element.propertyName.text);
                exportInfos.push(exportInfo);
            }
            else {
                let exportInfo = new ExportInfo();
                exportInfo.build(exportClauseName, exportClauseType, exportFrom);
                exportInfos.push(exportInfo);
            }
        });
    }
    // just like: export * as xx from './yy'
    if (node.exportClause && ts.isNamespaceExport(node.exportClause)) {
        let exportClauseType = "NamespaceExport";
        if (ts.isIdentifier(node.exportClause.name)) {
            let exportClauseName = node.exportClause.name.text;
            let nameBeforeAs = '*';
            let exportInfo = new ExportInfo();
            exportInfo.build(exportClauseName, exportClauseType, exportFrom, nameBeforeAs);
            exportInfos.push(exportInfo);
        }
    }
    // TODO: consider again
    // just like: export * from './yy'
    if (!node.exportClause && node.moduleSpecifier) {
        let exportClauseType = "NamespaceExport";
        let exportClauseName = '*';
        let exportInfo = new ExportInfo();
        exportInfo.build(exportClauseName, exportClauseType, exportFrom);
        exportInfos.push(exportInfo);
    }
    return exportInfos;
}
function buildExportAssignmentNode(node) {
    let exportInfos = [];
    if (node.expression) {
        if (ts.isIdentifier(node.expression)) {
            let exportClauseType = "default";
            let exportClauseName = node.expression.text;
            let exportInfo = new ExportInfo();
            exportInfo.build(exportClauseName, exportClauseType);
            exportInfos.push(exportInfo);
        }
        else if (ts.isObjectLiteralExpression(node.expression) && node.expression.properties) {
            let exportClauseType = "default-Obj";
            node.expression.properties.forEach((property) => {
                if (property.name && ts.isIdentifier(property.name)) {
                    let exportClauseName = property.name.text;
                    let exportInfo = new ExportInfo();
                    exportInfo.build(exportClauseName, exportClauseType);
                    exportInfos.push(exportInfo);
                }
            });
        }
    }
    return exportInfos;
}

const logger$a = ConsoleLogger.getLogger();
class NamespaceInfo {
    constructor() {
        this.modifiers = new Set();
    }
    getName() {
        return this.name;
    }
    setName(name) {
        this.name = name;
    }
    getModifiers() {
        return this.modifiers;
    }
    addModifier(modifier) {
        this.modifiers.add(modifier);
    }
}
function buildNamespaceInfo4NamespaceNode(node) {
    let namespaceInfo = new NamespaceInfo();
    if (node.modifiers) {
        buildModifiers(node.modifiers).forEach((modifier) => {
            namespaceInfo.addModifier(modifier);
        });
    }
    if (ts__default.isIdentifier(node.name)) {
        namespaceInfo.setName(node.name.text);
    }
    else if (ts__default.isStringLiteral(node.name)) {
        namespaceInfo.setName(node.name.text);
    }
    else {
        logger$a.warn("New namespace name type found. Please contact developers to add support for this!");
    }
    return namespaceInfo;
}

const logger$9 = ConsoleLogger.getLogger();
/**
 * ast节点类，属性包括父节点，子节点列表，种类，文本内容，开始位置
 */
class NodeA {
    constructor(node, parent, children, text, start, kind, classNodeInfo, methodNodeInfo, importNodeInfo, exportNodeInfo, namespaceNodeInfo) {
        this.line = -1;
        this.character = -1;
        this.parent = parent;
        this.children = children;
        this.text = text;
        this.start = start;
        if (node == undefined) {
            this.kind = kind;
        }
        else {
            this.kind = ts.SyntaxKind[node.kind];
            if (this.kind == "Block" || this.parent === null) {
                this.instanceMap = new Map();
            }
            else {
                this.instanceMap = undefined;
            }
        }
        this.classNodeInfo = classNodeInfo;
        this.methodNodeInfo = methodNodeInfo;
        this.importNodeInfo = importNodeInfo;
        this.exportNodeInfo = exportNodeInfo;
        this.namespaceNodeInfo = namespaceNodeInfo;
    }
    putInstanceMap(variableName, variableType) {
        if (typeof this.instanceMap === "undefined") {
            // instanceMap 未初始化
            let parentNode = this.parent;
            if (parentNode != null) {
                parentNode.putInstanceMap(variableName, variableType);
            }
        }
        else {
            // instanceMap 已初始化
            this.instanceMap.set(variableName, variableType);
        }
    }
    checkInstanceMap(variableName) {
        let parentNode = this.parent;
        if (typeof this.instanceMap !== "undefined") {
            // instanceMap 已初始化
            if (this.instanceMap.has(variableName)) {
                let value = this.instanceMap.get(variableName);
                return value !== undefined ? value : null;
            }
        }
        if (parentNode != null) {
            return parentNode.checkInstanceMap(variableName);
        }
        else {
            return null;
        }
    }
}
/**
 * ast类，目前的构造方式是传ts代码，之后可以考虑传文件路径等
 */
class ASTree {
    constructor(text) {
        this.root = new NodeA(undefined, null, [], "undefined", 0, "undefined");
        this.text = text;
        this.sourceFile = ts.createSourceFile("example.ts", this.text, ts.ScriptTarget.Latest);
        this.buildTree();
    }
    /**
     * 复制typescript的ast，因为typescript的ast的节点不能直接操作，因此通过之前自己建立的节点类进行复制
     * @param nodea 复制到nodea
     * @param node 要复制的节点node
     * @returns
     */
    copyTree(nodea, node) {
        let children = node === null || node === void 0 ? void 0 : node.getChildren(this.sourceFile);
        if (children == null) {
            return;
        }
        let cas = [];
        for (let child of children) {
            let ca;
            let classNodeInfo;
            let methodNodeInfo;
            let importNodeInfo;
            let exportNodeInfo;
            let namespaceNodeInfo;
            if (ts.isClassDeclaration(child) || ts.isClassExpression(child) ||
                ts.isInterfaceDeclaration(child) || ts.isEnumDeclaration(child)) {
                classNodeInfo = buildClassInfo4ClassNode(child, this.sourceFile);
            }
            if (ts.isFunctionDeclaration(child) || ts.isMethodDeclaration(child) || ts.isConstructorDeclaration(child) ||
                ts.isArrowFunction(child) || ts.isFunctionExpression(child) || ts.isAccessor(child) ||
                ts.isMethodSignature(child) || ts.isConstructSignatureDeclaration(child) ||
                ts.isCallSignatureDeclaration(child)) {
                methodNodeInfo = buildMethodInfo4MethodNode(child, this.sourceFile);
            }
            if (ts.isImportDeclaration(child) || ts.isImportEqualsDeclaration(child)) {
                importNodeInfo = buildImportInfo4ImportNode(child);
            }
            if (ts.isExportDeclaration(child) || ts.isExportAssignment(child)) {
                exportNodeInfo = buildExportInfo4ExportNode(child);
            }
            if (ts.isModuleDeclaration(child)) {
                namespaceNodeInfo = buildNamespaceInfo4NamespaceNode(child);
            }
            ca = new NodeA(child, nodea, [], child.getText(this.sourceFile), child.getStart(this.sourceFile), "", classNodeInfo, methodNodeInfo, importNodeInfo, exportNodeInfo, namespaceNodeInfo);
            const { line, character } = ts.getLineAndCharacterOfPosition(this.sourceFile, child.getStart(this.sourceFile));
            ca.line = line;
            ca.character = character;
            this.copyTree(ca, child);
            cas.push(ca);
            ca.parent = nodea;
        }
        nodea.children = cas;
    }
    // 建树
    buildTree() {
        const rootN = this.sourceFile.getChildren(this.sourceFile)[0];
        if (rootN == null)
            process.exit(0);
        const rootA = new NodeA(rootN, null, [], rootN.getText(this.sourceFile), rootN.getStart(this.sourceFile), "");
        const { line, character } = ts.getLineAndCharacterOfPosition(this.sourceFile, rootN.getStart(this.sourceFile));
        rootA.line = line;
        rootA.character = character;
        this.root = rootA;
        this.copyTree(rootA, rootN);
        // this.simplify(this.root);
    }
    singlePrintAST(node, i) {
        logger$9.info('   '.repeat(i) + node.kind);
        // logger.info(' '.repeat(i) + node.kind + ":" + node.text)
        if (node.children == null)
            return;
        for (let c of node.children) {
            this.singlePrintAST(c, i + 1);
        }
    }
    printAST() {
        if (this.root == null) {
            logger$9.warn("no root");
        }
        this.singlePrintAST(this.root, 0);
    }
    For2While(node) {
        let semicolon1 = -1, semicolon2 = -1;
        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i].kind == "SemicolonToken") {
                if (semicolon1 == -1)
                    semicolon1 = i;
                else
                    semicolon2 = i;
            }
        }
        let whileStatement = new NodeA(undefined, node.parent, [], "", -1, "WhileStatement");
        let whileKeyword = new NodeA(undefined, whileStatement, [], "while", -1, "WhileKeyword");
        let open = new NodeA(undefined, whileStatement, [], "(", -1, "OpenParenToken");
        let close = new NodeA(undefined, whileStatement, [], ")", -1, "CloseParenToken");
        let condition = node.children[semicolon1 + 1];
        let block = node.children[node.children.length - 1];
        block.parent = whileStatement;
        whileStatement.children = [whileKeyword, open, condition, close, block];
        if (!node.parent) {
            logger$9.error("for without parent");
            process.exit();
        }
        node.parent.children[node.parent.children.indexOf(node)] = whileStatement;
        if (node.children[semicolon1 - 1].kind != "OpenParenToken") {
            let initKind = "";
            let initChild = node.children[semicolon1 - 1];
            if (initChild.kind == "VariableDeclarationList")
                initKind = "FirstStatement";
            else
                initKind = "ExpressionStatement";
            let semi = new NodeA(undefined, whileStatement, [], ";", -1, "SemicolonToken");
            let init = new NodeA(undefined, node.parent, [initChild, semi], initChild.text + ";", -1, initKind);
            node.parent.children.splice(node.parent.children.indexOf(whileStatement), 0, init);
        }
        if (node.children[semicolon2 - 1].kind != "CloseParenToken") {
            let updateChild = node.children[semicolon2 + 1];
            let semi = new NodeA(undefined, whileStatement, [], ";", -1, "SemicolonToken");
            let update = new NodeA(undefined, block, [updateChild, semi], updateChild.text + ";", -1, "ExpressionStatement");
            block.children[1].children.push(update);
        }
        this.updateParentText(block.children[1]);
    }
    findChildIndex(node, kind) {
        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i].kind == kind)
                return i;
        }
        return -1;
    }
    forOfIn2For(node) {
        let VariableDeclarationList = node.children[this.findChildIndex(node, "VariableDeclarationList")];
        let SyntaxList = VariableDeclarationList.children[this.findChildIndex(VariableDeclarationList, "SyntaxList")];
        let decl = SyntaxList.children[0].children[0].text;
        let array = node.children[this.findChildIndex(node, 'CloseParenToken') - 1].text;
        let tempTree = new ASTree("for(let _i=0;_i<" + array + ".length;_i++)");
        let forStm = tempTree.root.children[0];
        forStm.parent = node.parent;
        if (node.parent)
            node.parent.children[node.parent.children.indexOf(node)] = forStm;
        let block = node.children[this.findChildIndex(node, "Block")];
        forStm.children[forStm.children.length - 1] = block;
        tempTree = new ASTree("let " + decl + "=" + array + "[_i];");
        let initStm = tempTree.root.children[0];
        block.children[1].children.splice(0, 0, initStm);
        this.updateParentText(forStm);
        return forStm;
    }
    simplify(node) {
        if (node.kind == "ForInStatement" || node.kind == "ForOfStatement") {
            this.For2While(this.forOfIn2For(node));
        }
        if (node.kind == "ForStatement") {
            this.For2While(node);
        }
        for (let child of node.children) {
            this.simplify(child);
        }
    }
    updateParentText(node) {
        if (!node)
            return;
        node.text = "";
        for (let child of node.children) {
            node.text += child.text;
            if (child.kind.includes("Keyword"))
                node.text += " ";
            if (node.kind == "SyntaxList" && child.kind.includes("Statement"))
                node.text += "\r\n";
        }
        if (node.parent)
            this.updateParentText(node.parent);
    }
    updateStart(node) {
        for (let i = 0; i < node.children.length; i++) {
            if (i == 0) {
                node.children[i].start = node.start;
            }
            else {
                node.children[i].start = node.children[i - 1].start + node.children[i].text.length;
            }
            this.updateStart(node.children[i]);
        }
    }
}

class BasicBlock {
    constructor() {
        this.stmts = [];
        this.predecessorBlocks = [];
        this.successorBlocks = [];
    }
    getStmts() {
        return this.stmts;
    }
    addStmt(stmt) {
        this.stmts.push(stmt);
    }
    getHead() {
        if (this.stmts.length == 0) {
            return null;
        }
        return this.stmts[0];
    }
    getTail() {
        let size = this.stmts.length;
        if (size == 0) {
            return null;
        }
        return this.stmts[size - 1];
    }
    getSuccessors() {
        return this.successorBlocks;
    }
    setSuccessorBlock(successorIdx, block) {
        this.updateSuccessorContainer();
        if (successorIdx >= this.successorBlocks.length) {
            return false;
        }
        this.successorBlocks[successorIdx] = block;
        return true;
    }
    getPredecessors() {
        return this.predecessorBlocks;
    }
    addPredecessorBlock(block) {
        this.predecessorBlocks.push(block);
    }
    updateSuccessorContainer() {
        let tail = this.getTail();
        if (tail) {
            let expectedSuccessorCount = tail.getExpectedSuccessorCount();
            if (expectedSuccessorCount != this.successorBlocks.length) {
                this.successorBlocks = new Array(expectedSuccessorCount);
            }
        }
    }
    // Temp just for SSA
    addStmtToFirst(stmt) {
        this.stmts.splice(0, 0, stmt);
    }
    // Temp just for SSA
    addSuccessorBlock(block) {
        this.successorBlocks.push(block);
    }
    toString() {
        let strs = [];
        for (const stmt of this.stmts) {
            strs.push(stmt.toString() + '\n');
        }
        return strs.join('');
    }
}

let DefUseChain$1 = class DefUseChain {
    constructor(value, def, use) {
        this.value = value;
        this.def = def;
        this.use = use;
    }
};

class Cfg {
    constructor() {
        this.blocks = new Set();
        this.stmtToBlock = new Map();
        this.startingStmt = new Stmt();
        this.defUseChains = [];
    }
    getStmts() {
        let stmts = new Array();
        for (const block of this.blocks) {
            stmts.push(...block.getStmts());
        }
        return stmts;
    }
    // TODO
    insertBefore(beforeStmt, newStmt) {
        const block = this.stmtToBlock.get(beforeStmt);
        // Simplify edition just for SSA
        block.addStmtToFirst(newStmt);
        this.stmtToBlock.set(newStmt, block);
    }
    // TODO: 添加block之间的边
    addBlock(block) {
        this.blocks.add(block);
        for (const stmt of block.getStmts()) {
            this.stmtToBlock.set(stmt, block);
        }
    }
    getBlocks() {
        return this.blocks;
    }
    getStartingBlock() {
        return this.stmtToBlock.get(this.startingStmt);
    }
    getStartingStmt() {
        return this.startingStmt;
    }
    setStartingStmt(newStartingStmt) {
        this.startingStmt = newStartingStmt;
    }
    getDeclaringMethod() {
        return this.declaringMethod;
    }
    setDeclaringMethod(method) {
        this.declaringMethod = method;
    }
    getDefUseChains() {
        return this.defUseChains;
    }
    constructorAddInit(arkMethod) {
        const stmts = [...this.blocks][0].getStmts();
        let index = arkMethod.getParameters().length;
        // let cThis: 
        const cThis = stmts[index].getDef();
        for (const field of arkMethod.getDeclaringArkClass().getFields()) {
            let init = field.getInitializer();
            if (init == undefined) {
                init = new Constant('undefined', UndefinedType.getInstance());
            }
            let leftOp;
            if (field.isStatic()) {
                leftOp = new ArkStaticFieldRef(field.getSignature());
            }
            else {
                leftOp = new ArkInstanceFieldRef(cThis, field.getSignature());
            }
            const assignStmt = new ArkAssignStmt(leftOp, init);
            index++;
            stmts.splice(index, 0, assignStmt);
        }
    }
    // TODO: 整理成类似jimple的输出
    toString() {
        return 'cfg';
    }
    buildDefUseStmt() {
        for (const block of this.blocks) {
            for (const stmt of block.getStmts()) {
                const defValue = stmt.getDef();
                if (defValue && defValue instanceof Local) {
                    defValue.setDeclaringStmt(stmt);
                }
                for (const value of stmt.getUses()) {
                    if (value instanceof Local) {
                        const local = value;
                        local.addUsedStmt(stmt);
                    }
                }
            }
        }
    }
    buildDefUseChain() {
        var _a, _b;
        for (const block of this.blocks) {
            for (let stmtIndex = 0; stmtIndex < block.getStmts().length; stmtIndex++) {
                const stmt = block.getStmts()[stmtIndex];
                for (const value of stmt.getUses()) {
                    const name = value.toString();
                    const defStmts = [];
                    // 判断本block之前有无对应def
                    for (let i = stmtIndex - 1; i >= 0; i--) {
                        const beforeStmt = block.getStmts()[i];
                        if (beforeStmt.getDef() && ((_a = beforeStmt.getDef()) === null || _a === void 0 ? void 0 : _a.toString()) == name) {
                            defStmts.push(beforeStmt);
                            break;
                        }
                    }
                    // 本block有对应def直接结束,否则找所有的前序block
                    if (defStmts.length != 0) {
                        this.defUseChains.push(new DefUseChain$1(value, defStmts[0], stmt));
                    }
                    else {
                        const needWalkBlocks = [];
                        for (const predecessor of block.getPredecessors()) {
                            needWalkBlocks.push(predecessor);
                        }
                        const walkedBlocks = new Set();
                        while (needWalkBlocks.length > 0) {
                            const predecessor = needWalkBlocks.pop();
                            if (!predecessor) {
                                return;
                            }
                            const predecessorStmts = predecessor.getStmts();
                            let predecessorHasDef = false;
                            for (let i = predecessorStmts.length - 1; i >= 0; i--) {
                                const beforeStmt = predecessorStmts[i];
                                if (beforeStmt.getDef() && ((_b = beforeStmt.getDef()) === null || _b === void 0 ? void 0 : _b.toString()) == name) {
                                    defStmts.push(beforeStmt);
                                    predecessorHasDef = true;
                                    break;
                                }
                            }
                            if (!predecessorHasDef) {
                                for (const morePredecessor of predecessor.getPredecessors()) {
                                    if (!walkedBlocks.has(morePredecessor) && !needWalkBlocks.includes(morePredecessor))
                                        needWalkBlocks.unshift(morePredecessor);
                                }
                            }
                            walkedBlocks.add(predecessor);
                        }
                        for (const def of defStmts) {
                            this.defUseChains.push(new DefUseChain$1(value, def, stmt));
                        }
                    }
                }
            }
        }
    }
}

class IRUtils {
    static moreThanOneAddress(value) {
        if (value instanceof ArkBinopExpr || value instanceof AbstractInvokeExpr || value instanceof ArkInstanceFieldRef ||
            value instanceof ArkArrayRef) {
            return true;
        }
        return false;
    }
}

const logger$8 = ConsoleLogger.getLogger();
class StatementBuilder {
    constructor(type, code, astNode, scopeID) {
        this.passTmies = 0;
        this.numOfIdentifier = 0;
        this.isDoWhile = false;
        this.type = type;
        this.code = code;
        this.next = null;
        this.lasts = [];
        this.walked = false;
        this.index = 0;
        this.line = 0;
        this.astNode = astNode;
        this.scopeID = scopeID;
        this.use = new Set;
        this.def = new Set;
        this.defspecial = new Set;
        this.addressCode3 = [];
        this.threeAddressStmts = [];
        this.haveCall = false;
        this.block = null;
        this.ifExitPass = false;
    }
}
class ConditionStatementBuilder extends StatementBuilder {
    constructor(type, code, astNode, scopeID) {
        super(type, code, astNode, scopeID);
        this.doStatement = null;
        this.nextT = null;
        this.nextF = null;
        this.loopBlock = null;
        this.condition = "";
    }
}
class SwitchStatementBuilder extends StatementBuilder {
    constructor(type, code, astNode, scopeID) {
        super(type, code, astNode, scopeID);
        this.cases = [];
        this.default = null;
        this.nexts = [];
    }
}
class TryStatementBuilder extends StatementBuilder {
    constructor(type, code, astNode, scopeID) {
        super(type, code, astNode, scopeID);
        this.tryFirst = null;
        this.tryExit = null;
        this.catchStatement = null;
        this.catchError = "";
        this.finallyStatement = null;
    }
}
class Case {
    constructor(value, stm) {
        this.value = value;
        this.stm = stm;
    }
}
class DefUseChain {
    constructor(def, use) {
        this.def = def;
        this.use = use;
    }
}
class Variable {
    constructor(name, lastDef) {
        this.properties = [];
        this.propOf = null;
        this.name = name;
        this.lastDef = lastDef;
        this.defUse = [];
    }
}
let Scope$1 = class Scope {
    constructor(id, variable, level) {
        this.id = id;
        this.variable = variable;
        this.level = level;
        this.parent = null;
    }
};
class Block {
    constructor(id, stms, loopStmt) {
        this.walked = false;
        this.id = id;
        this.stms = stms;
        this.nexts = new Set();
        this.lasts = new Set();
        this.loopStmt = loopStmt;
    }
}
class Catch {
    constructor(errorName, from, to, withLabel) {
        this.errorName = errorName;
        this.from = from;
        this.to = to;
        this.withLabel = withLabel;
    }
}
class textError extends Error {
    constructor(message) {
        // 调用父类的构造函数，并传入错误消息
        super(message);
        // 设置错误类型的名称
        this.name = "textError";
    }
}
class CfgBuilder {
    constructor(ast, name, declaringMethod) {
        this.locals = new Set();
        this.thisLocal = new Local('this');
        this.paraLocals = [];
        this.name = name;
        this.astRoot = ast;
        this.declaringMethod = declaringMethod;
        this.declaringClass = declaringMethod.getDeclaringArkClass();
        this.entry = new StatementBuilder("entry", "", ast, 0);
        this.loopStack = [];
        this.switchExitStack = [];
        this.functions = [];
        this.breakin = "";
        this.statementArray = [];
        this.dotEdges = [];
        this.exit = new StatementBuilder("exit", "return;", null, 0);
        this.scopes = [];
        this.scopeLevel = 0;
        this.tempVariableNum = 0;
        this.current3ACstm = this.entry;
        this.blocks = [];
        this.entryBlock = new Block(this.blocks.length, [this.entry], null);
        this.exitBlock = new Block(-1, [this.entry], null);
        this.currentDeclarationKeyword = "";
        this.variables = [];
        this.importFromPath = [];
        this.catches = [];
        this.anonymousFuncIndex = 0;
        this.anonymousFunctions = [];
        this.anonymousClassIndex = 0;
        this.buildCfgBuilder();
    }
    walkAST(lastStatement, nextStatement, node) {
        var _a;
        function judgeLastType(s) {
            if (lastStatement.type == "ifStatement") {
                let lastIf = lastStatement;
                if (lastIf.nextT == null) {
                    lastIf.nextT = s;
                }
                else {
                    lastIf.nextF = s;
                }
            }
            else if (lastStatement.type == "loopStatement") {
                let lastLoop = lastStatement;
                lastLoop.nextT = s;
            }
            else if (lastStatement.type == "catchOrNot") {
                let lastLoop = lastStatement;
                lastLoop.nextT = s;
            }
            else {
                lastStatement.next = s;
            }
        }
        // logger.info(node.text)
        this.scopeLevel++;
        let scope = new Scope$1(this.scopes.length, new Set(), this.scopeLevel);
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].level == this.scopeLevel - 1) {
                scope.parent = this.scopes[i];
                break;
            }
        }
        this.scopes.push(scope);
        for (let i = 0; i < (node === null || node === void 0 ? void 0 : node.children.length); i++) {
            let c = node.children[i];
            if (c.kind == "FirstStatement" || c.kind == "VariableStatement" || c.kind == "ExpressionStatement" || c.kind == "ThrowStatement") {
                if (c.kind == "FirstStatement" || c.kind == "VariableStatement") {
                    let declList = c.children[this.findChildIndex(c, "VariableDeclarationList")];
                    declList = declList.children[this.findChildIndex(declList, "SyntaxList")];
                    for (let decl of declList.children) {
                        scope.variable.add((_a = decl.children[0]) === null || _a === void 0 ? void 0 : _a.text);
                    }
                }
                let s = new StatementBuilder("statement", c.text, c, scope.id);
                judgeLastType(s);
                lastStatement = s;
            }
            if (c.kind == "ImportDeclaration") {
                let stm = new StatementBuilder("statement", c.text, c, scope.id);
                judgeLastType(stm);
                lastStatement = stm;
                stm.astNode = c;
                let indexPath = this.findChildIndex(c, "FromKeyword") + 1;
                this.importFromPath.push(c.children[indexPath].text);
            }
            if (c.kind == "ReturnStatement") {
                let s = new StatementBuilder("returnStatement", c.text, c, scope.id);
                judgeLastType(s);
                s.astNode = c;
                lastStatement = s;
                break;
            }
            if (c.kind == "BreakStatement") {
                let brstm = new StatementBuilder("breakStatement", "break;", c, scope.id);
                judgeLastType(brstm);
                let p = c;
                while (p) {
                    if (p.kind.includes("While") || p.kind.includes("For")) {
                        brstm.next = this.loopStack[this.loopStack.length - 1].nextF;
                        break;
                    }
                    if (p.kind.includes("CaseClause") || p.kind.includes("DefaultClause")) {
                        brstm.next = this.switchExitStack[this.switchExitStack.length - 1];
                        break;
                    }
                    p = p.parent;
                }
                lastStatement = brstm;
            }
            if (c.kind == "ContinueStatement") {
                let constm = new StatementBuilder("continueStatement", "continue;", c, scope.id);
                judgeLastType(constm);
                constm.next = this.loopStack[this.loopStack.length - 1];
                lastStatement = constm;
            }
            if (c.kind == "IfStatement") {
                let ifstm = new ConditionStatementBuilder("ifStatement", "", c, scope.id);
                judgeLastType(ifstm);
                let ifexit = new StatementBuilder("ifExit", "", c, scope.id);
                let elsed = false;
                for (let j = 0; j < c.children.length; j++) {
                    let ifchild = c.children[j];
                    if (ifchild.kind == "OpenParenToken") {
                        ifstm.condition = c.children[j + 1].text;
                        // expressionCondition=true;
                        ifstm.code = "if (" + ifstm.condition + ")";
                    }
                    if ((ifchild.kind == "CloseParenToken" || ifchild.kind == "ElseKeyword") && c.children[j + 1].kind != "Block") {
                        let tempBlock = new NodeA(undefined, c, [], "undefined", 0, "Block");
                        tempBlock.kind = "Block";
                        tempBlock.text = "tempBlock";
                        let temp0 = new NodeA(undefined, tempBlock, [], "undefined", 0, "undefined");
                        let temp1 = new NodeA(undefined, tempBlock, [c.children[j + 1]], "undefined", 0, "undefined");
                        tempBlock.children = [temp0, temp1];
                        c.children[j + 1] = tempBlock;
                    }
                    if (ifchild.kind == "ElseKeyword")
                        elsed = true;
                    if (ifchild.kind == "Block") {
                        this.walkAST(ifstm, ifexit, ifchild.children[1]);
                    }
                }
                if (!elsed || !ifstm.nextF) {
                    ifstm.nextF = ifexit;
                }
                if (!ifstm.nextT) {
                    ifstm.nextT = ifexit;
                }
                lastStatement = ifexit;
            }
            if (c.kind == "WhileStatement") {
                this.breakin = "loop";
                let loopstm = new ConditionStatementBuilder("loopStatement", "", c, scope.id);
                this.loopStack.push(loopstm);
                judgeLastType(loopstm);
                let loopExit = new StatementBuilder("loopExit", "", c, scope.id);
                loopstm.nextF = loopExit;
                for (let j = 0; j < c.children.length; j++) {
                    let loopchild = c.children[j];
                    if (loopchild.kind == "OpenParenToken") {
                        // expressionCondition=true;
                        loopstm.condition = c.children[j + 1].text;
                        loopstm.code = "while (" + loopstm.condition + ")";
                    }
                    if ((loopchild.kind == "CloseParenToken") && c.children[j + 1].kind != "Block") {
                        let tempBlock = new NodeA(undefined, c, [], "undefined", 0, "Block");
                        tempBlock.kind = "Block";
                        tempBlock.text = "tempBlock";
                        let temp0 = new NodeA(undefined, tempBlock, [], "undefined", 0, "undefined");
                        let temp1 = new NodeA(undefined, tempBlock, [c.children[j + 1]], "undefined", 0, "undefined");
                        tempBlock.children = [temp0, temp1];
                        c.children[j + 1] = tempBlock;
                    }
                    if (loopchild.kind == "Block") {
                        this.walkAST(loopstm, loopstm, loopchild.children[1]);
                    }
                }
                if (!loopstm.nextF) {
                    loopstm.nextF = loopExit;
                }
                if (!loopstm.nextT) {
                    loopstm.nextT = loopExit;
                }
                lastStatement = loopExit;
                this.loopStack.pop();
            }
            if (c.kind == "ForStatement" || c.kind == "ForInStatement" || c.kind == "ForOfStatement") {
                this.breakin = "loop";
                let loopstm = new ConditionStatementBuilder("loopStatement", "", c, scope.id);
                this.loopStack.push(loopstm);
                judgeLastType(loopstm);
                let loopExit = new StatementBuilder("loopExit", "", c, scope.id);
                loopstm.nextF = loopExit;
                let code = "";
                for (let loopchild of c.children) {
                    if (loopchild.kind != "Block") {
                        code += loopchild.text;
                        const nextChild = c.children[c.children.indexOf(loopchild) + 1];
                        if (nextChild && loopchild.text != "(" && nextChild.text != ")" && nextChild.text != ";") {
                            code += ' ';
                        }
                    }
                    else {
                        loopstm.code = code;
                        this.walkAST(loopstm, loopstm, loopchild.children[1]);
                    }
                }
                if (!loopstm.nextF) {
                    loopstm.nextF = loopExit;
                }
                if (!loopstm.nextT) {
                    loopstm.nextT = loopExit;
                }
                lastStatement = loopExit;
                this.loopStack.pop();
            }
            if (c.kind == "DoStatement") {
                this.breakin = "loop";
                let loopstm = new ConditionStatementBuilder("loopStatement", "", c, scope.id);
                this.loopStack.push(loopstm);
                let loopExit = new StatementBuilder("loopExit", "", c, scope.id);
                loopstm.nextF = loopExit;
                // let expressionCondition=false;
                for (let j = 0; j < c.children.length; j++) {
                    let loopchild = c.children[j];
                    if (loopchild.kind == "OpenParenToken") {
                        // expressionCondition=true;
                        loopstm.condition = c.children[j + 1].text;
                        loopstm.code = "while (" + loopstm.condition + ")";
                    }
                    if (loopchild.kind == "Block") {
                        this.walkAST(lastStatement, loopstm, loopchild.children[1]);
                    }
                }
                let lastType = lastStatement.type;
                if (lastType == "ifStatement" || lastType == "loopStatement") {
                    let lastCondition = lastStatement;
                    loopstm.nextT = lastCondition.nextT;
                }
                else {
                    loopstm.nextT = lastStatement.next;
                }
                if (loopstm.nextT && loopstm.nextT != loopstm) {
                    loopstm.nextT.isDoWhile = true;
                    loopstm.doStatement = loopstm.nextT;
                }
                lastStatement = loopExit;
                this.loopStack.pop();
            }
            if (c.kind == "SwitchStatement") {
                this.breakin = "switch";
                let switchstm = new SwitchStatementBuilder("switchStatement", "", c, scope.id);
                judgeLastType(switchstm);
                let switchExit = new StatementBuilder("switchExit", "", null, scope.id);
                this.switchExitStack.push(switchExit);
                for (let schild of c.children) {
                    if (schild.kind != "CaseBlock") {
                        switchstm.code += schild.text;
                    }
                    else {
                        let lastCaseExit = null;
                        let preCases = [];
                        for (let j = 0; j < schild.children[1].children.length; j++) {
                            let caseClause = schild.children[1].children[j];
                            let syntaxList = null;
                            let caseWords = "";
                            for (let caseChild of caseClause.children) {
                                if (caseChild.kind == "SyntaxList") {
                                    syntaxList = caseChild;
                                    break;
                                }
                                else {
                                    caseWords += caseChild.text + " ";
                                }
                            }
                            if (syntaxList == null) {
                                logger$8.warn("caseClause without syntaxList");
                                process.exit();
                            }
                            if (syntaxList.children.length == 0) {
                                preCases.push(caseWords);
                            }
                            else {
                                let thisCase = caseWords;
                                for (let w of preCases) {
                                    caseWords += w + " ";
                                }
                                let casestm = new StatementBuilder("statement", caseWords, caseClause, scope.id);
                                switchstm.nexts.push(casestm);
                                let caseExit = new StatementBuilder("caseExit", "", null, scope.id);
                                this.walkAST(casestm, caseExit, syntaxList);
                                for (let w of preCases) {
                                    if (casestm.next) {
                                        let cas = new Case(w, casestm.next);
                                        switchstm.cases.push(cas);
                                    }
                                }
                                if (casestm.next) {
                                    if (caseClause.kind == "CaseClause") {
                                        let cas = new Case(thisCase, casestm.next);
                                        switchstm.cases.push(cas);
                                    }
                                    else
                                        switchstm.default = casestm.next;
                                }
                                if (lastCaseExit) {
                                    lastCaseExit.next = casestm.next;
                                }
                                if (j == schild.children[1].children.length - 1) {
                                    caseExit.next = switchExit;
                                }
                                else {
                                    lastCaseExit = caseExit;
                                }
                                preCases = [];
                            }
                        }
                        if (lastCaseExit && !lastCaseExit.next) {
                            lastCaseExit.next = switchExit;
                        }
                    }
                }
                lastStatement = switchExit;
                this.switchExitStack.pop();
            }
            if (c.kind == "Block") {
                let blockExit = new StatementBuilder("blockExit", "", c, scope.id);
                this.walkAST(lastStatement, blockExit, c.children[1]);
                lastStatement = blockExit;
            }
            if (c.kind == "TryStatement") {
                let trystm = new TryStatementBuilder("tryStatement", "try", c, scope.id);
                judgeLastType(trystm);
                let tryExit = new StatementBuilder("try exit", "", c, scope.id);
                trystm.tryExit = tryExit;
                this.walkAST(trystm, tryExit, c.children[1].children[1]);
                trystm.tryFirst = trystm.next;
                // lastStatement=tryExit;
                let catchClause = null;
                let finalBlock = null;
                let haveFinal = false;
                for (let trychild of c.children) {
                    if (haveFinal) {
                        finalBlock = trychild;
                        break;
                    }
                    if (trychild.kind == "CatchClause") {
                        catchClause = trychild;
                        let text = "catch";
                        if (catchClause.children.length > 2) {
                            text = catchClause.children[0].text + catchClause.children[1].text + catchClause.children[2].text + catchClause.children[3].text;
                        }
                        let catchOrNot = new ConditionStatementBuilder("catchOrNot", text, c, scope.id);
                        // judgeLastType(catchOrNot);
                        let catchExit = new StatementBuilder("catch exit", "", c, scope.id);
                        catchOrNot.nextF = catchExit;
                        let block = catchClause.children[this.findChildIndex(catchClause, "Block")];
                        this.walkAST(catchOrNot, catchExit, block.children[1]);
                        if (!catchOrNot.nextT) {
                            catchOrNot.nextT = catchExit;
                        }
                        const catchStatement = new StatementBuilder("statement", catchOrNot.code, trychild, catchOrNot.nextT.scopeID);
                        catchStatement.next = catchOrNot.nextT;
                        trystm.catchStatement = catchStatement;
                        let VD = catchClause.children[this.findChildIndex(catchClause, "VariableDeclaration")];
                        if (VD) {
                            if (VD.children[0].kind == "Identifier") {
                                trystm.catchError = VD.children[0].text;
                            }
                            else {
                                let error = VD.children[this.findChildIndex(VD, "TypeReference")];
                                if (error) {
                                    trystm.catchError = error.text;
                                }
                                else {
                                    trystm.catchError = "Error";
                                }
                            }
                        }
                        else {
                            trystm.catchError = "Error";
                        }
                    }
                    if (trychild.kind == "FinallyKeyword") {
                        haveFinal = true;
                    }
                }
                if (finalBlock && finalBlock.children[1].children.length > 0) {
                    let final = new StatementBuilder("statement", "finally", c, scope.id);
                    let finalExit = new StatementBuilder("finally exit", "", c, scope.id);
                    this.walkAST(final, finalExit, finalBlock.children[1]);
                    trystm.finallyStatement = final.next;
                }
                lastStatement = trystm;
            }
        }
        this.scopeLevel--;
        if (lastStatement.type != "breakStatement" && lastStatement.type != "continueStatement") {
            lastStatement.next = nextStatement;
        }
    }
    addReturnInEmptyMethod() {
        if (this.entry.next == this.exit) {
            const ret = new StatementBuilder("returnStatement", "return;", null, this.entry.scopeID);
            this.entry.next = ret;
            ret.next = this.exit;
        }
    }
    deleteExit(stm) {
        var _a, _b, _c;
        if (stm.walked)
            return;
        stm.walked = true;
        if (stm.type == "ifStatement" || stm.type == "loopStatement" || stm.type == "catchOrNot") {
            let cstm = stm;
            if ((_a = cstm.nextT) === null || _a === void 0 ? void 0 : _a.type.includes("Exit")) {
                let p = cstm.nextT;
                while (p.type.includes("Exit")) {
                    if (p.next == null) {
                        logger$8.error("exit error");
                        process.exit();
                    }
                    p = p.next;
                }
                cstm.nextT = p;
            }
            if ((_b = cstm.nextF) === null || _b === void 0 ? void 0 : _b.type.includes("Exit")) {
                let p = cstm.nextF;
                while (p.type.includes("Exit")) {
                    if (p.next == null) {
                        logger$8.error("exit error");
                        process.exit();
                    }
                    p = p.next;
                }
                cstm.nextF = p;
            }
            if (cstm.nextT == null || cstm.nextF == null) {
                this.errorTest(cstm);
                return;
            }
            this.deleteExit(cstm.nextT);
            this.deleteExit(cstm.nextF);
        }
        else if (stm.type == "switchStatement") {
            let sstm = stm;
            for (let j in sstm.nexts) {
                let caseClause = sstm.nexts[j];
                if (caseClause.type.includes("Exit")) {
                    let p = caseClause;
                    while (p.type.includes("Exit")) {
                        if (p.next == null) {
                            logger$8.error("exit error");
                            process.exit();
                        }
                        p = p.next;
                    }
                    sstm.nexts[j] = p;
                }
                this.deleteExit(sstm.nexts[j]);
            }
        }
        else if (stm.type == "tryStatement") {
            let trystm = stm;
            if (trystm.tryFirst) {
                this.deleteExit(trystm.tryFirst);
            }
            if (trystm.catchStatement) {
                this.deleteExit(trystm.catchStatement);
            }
            if (trystm.finallyStatement) {
                this.deleteExit(trystm.finallyStatement);
            }
        }
        else {
            if ((_c = stm.next) === null || _c === void 0 ? void 0 : _c.type.includes("Exit")) {
                let p = stm.next;
                while (p.type.includes("Exit")) {
                    if (p.next == null) {
                        logger$8.error("error exit");
                        process.exit();
                    }
                    p = p.next;
                }
                stm.next = p;
            }
            if (stm.next)
                this.deleteExit(stm.next);
        }
    }
    buildNewBlock(stms) {
        let block;
        if (this.blocks.length > 0 && this.blocks[this.blocks.length - 1].stms.length == 0) {
            block = this.blocks[this.blocks.length - 1];
            block.stms = stms;
        }
        else {
            block = new Block(this.blocks.length, stms, null);
            this.blocks.push(block);
        }
        return block;
    }
    buildBlocks(stm, block) {
        if (stm.type.includes(" exit")) {
            stm.block = block;
            return;
        }
        if (stm.walked || stm.type == "exit")
            return;
        stm.walked = true;
        if (stm.type == "entry") {
            let b = this.buildNewBlock([]);
            // block.nexts.push(b);
            if (stm.next != null)
                this.buildBlocks(stm.next, b);
            return;
        }
        if (stm.type != "loopStatement" && stm.type != "tryStatement" || (stm instanceof ConditionStatementBuilder && stm.doStatement)) {
            block.stms.push(stm);
            stm.block = block;
        }
        if (stm.type == "ifStatement" || stm.type == "loopStatement" || stm.type == "catchOrNot") {
            let cstm = stm;
            if (cstm.nextT == null || cstm.nextF == null) {
                this.errorTest(cstm);
                return;
            }
            if (cstm.type == "loopStatement" && !cstm.doStatement) {
                let loopBlock = this.buildNewBlock([cstm]);
                block = loopBlock;
                cstm.block = block;
            }
            let b1 = this.buildNewBlock([]);
            this.buildBlocks(cstm.nextT, b1);
            let b2 = this.buildNewBlock([]);
            this.buildBlocks(cstm.nextF, b2);
        }
        else if (stm.type == "switchStatement") {
            let sstm = stm;
            for (const cas of sstm.cases) {
                this.buildBlocks(cas.stm, this.buildNewBlock([]));
            }
            if (sstm.default) {
                this.buildBlocks(sstm.default, this.buildNewBlock([]));
            }
        }
        else if (stm.type == "tryStatement") {
            let trystm = stm;
            if (!trystm.tryFirst) {
                logger$8.error("try without tryFirst");
                process.exit();
            }
            let tryFirstBlock = this.buildNewBlock([]);
            trystm.block = tryFirstBlock;
            if (block.stms.length > 0) {
                block.nexts.add(tryFirstBlock);
                tryFirstBlock.lasts.add(block);
            }
            this.buildBlocks(trystm.tryFirst, tryFirstBlock);
            const lastBlocksInTry = new Set();
            if (!trystm.tryExit) {
                process.exit();
            }
            for (let stm of trystm.tryExit.lasts) {
                if (stm.block)
                    lastBlocksInTry.add(stm.block);
            }
            let finallyBlock = this.buildNewBlock([]);
            let lastFinallyBlock = null;
            if (trystm.finallyStatement) {
                this.buildBlocks(trystm.finallyStatement, finallyBlock);
                lastFinallyBlock = this.blocks[this.blocks.length - 1];
            }
            else {
                let stm = new StatementBuilder("tmp", "", null, -1);
                finallyBlock.stms = [stm];
            }
            for (let lastBlockInTry of lastBlocksInTry) {
                lastBlockInTry.nexts.add(finallyBlock);
                finallyBlock.lasts.add(lastBlockInTry);
            }
            if (trystm.catchStatement) {
                let catchBlock = this.buildNewBlock([]);
                this.buildBlocks(trystm.catchStatement, catchBlock);
                for (let lastBlockInTry of lastBlocksInTry) {
                    lastBlockInTry.nexts.add(catchBlock);
                    catchBlock.lasts.add(lastBlockInTry);
                }
                catchBlock.nexts.add(finallyBlock);
                finallyBlock.lasts.add(catchBlock);
                this.catches.push(new Catch(trystm.catchError, tryFirstBlock.id, finallyBlock.id, catchBlock.id));
            }
            let nextBlock = this.buildNewBlock([]);
            if (lastFinallyBlock) {
                finallyBlock = lastFinallyBlock;
            }
            if (trystm.next)
                this.buildBlocks(trystm.next, nextBlock);
            let goto = new StatementBuilder("gotoStatement", "goto label" + nextBlock.id, null, trystm.tryFirst.scopeID);
            goto.block = finallyBlock;
            if (trystm.finallyStatement) {
                if (trystm.catchStatement)
                    finallyBlock.stms.push(goto);
            }
            else {
                finallyBlock.stms = [goto];
            }
            finallyBlock.nexts.add(nextBlock);
            nextBlock.lasts.add(finallyBlock);
            if (nextBlock.stms.length == 0) {
                const returnStatement = new StatementBuilder("returnStatement", "return;", null, trystm.tryFirst.scopeID);
                goto.next = returnStatement;
                returnStatement.lasts = [goto];
                nextBlock.stms.push(returnStatement);
                returnStatement.block = nextBlock;
            }
        }
        else {
            if (stm.next) {
                if (stm.type == "continueStatement" && stm.next.block) {
                    return;
                }
                if (stm.next.type == "loopStatement" && stm.next.block) {
                    block = stm.next.block;
                    return;
                }
                stm.next.passTmies++;
                if (stm.next.passTmies == stm.next.lasts.length || (stm.next.type == "loopStatement") || stm.next.isDoWhile) {
                    if (stm.next.scopeID != stm.scopeID && !stm.next.type.includes(" exit") && !(stm.next instanceof ConditionStatementBuilder && stm.next.doStatement)) {
                        let b = this.buildNewBlock([]);
                        block = b;
                    }
                    this.buildBlocks(stm.next, block);
                }
            }
        }
    }
    buildBlocksNextLast() {
        var _a, _b, _c, _d, _e, _f;
        for (let block of this.blocks) {
            for (let originStatement of block.stms) {
                let lastStatement = (block.stms.indexOf(originStatement) == block.stms.length - 1);
                if (originStatement instanceof ConditionStatementBuilder) {
                    let nextT = (_a = originStatement.nextT) === null || _a === void 0 ? void 0 : _a.block;
                    if (nextT && (lastStatement || nextT != block) && !((_b = originStatement.nextT) === null || _b === void 0 ? void 0 : _b.type.includes(" exit"))) {
                        block.nexts.add(nextT);
                        nextT.lasts.add(block);
                    }
                    let nextF = (_c = originStatement.nextF) === null || _c === void 0 ? void 0 : _c.block;
                    if (nextF && (lastStatement || nextF != block) && !((_d = originStatement.nextF) === null || _d === void 0 ? void 0 : _d.type.includes(" exit"))) {
                        block.nexts.add(nextF);
                        nextF.lasts.add(block);
                    }
                }
                else if (originStatement instanceof SwitchStatementBuilder) {
                    for (const cas of originStatement.cases) {
                        const next = cas.stm.block;
                        if (next && (lastStatement || next != block) && !cas.stm.type.includes(" exit")) {
                            block.nexts.add(next);
                            next.lasts.add(block);
                        }
                    }
                    if (originStatement.default) {
                        const next = originStatement.default.block;
                        if (next && (lastStatement || next != block) && !originStatement.default.type.includes(" exit")) {
                            block.nexts.add(next);
                            next.lasts.add(block);
                        }
                    }
                }
                else {
                    let next = (_e = originStatement.next) === null || _e === void 0 ? void 0 : _e.block;
                    if (next && (lastStatement || next != block) && !((_f = originStatement.next) === null || _f === void 0 ? void 0 : _f.type.includes(" exit"))) {
                        block.nexts.add(next);
                        next.lasts.add(block);
                    }
                }
            }
        }
    }
    addReturnBlock() {
        var _a, _b;
        let notReturnStmts = [];
        for (let stmt of this.exit.lasts) {
            if (stmt.type != "returnStatement") {
                notReturnStmts.push(stmt);
            }
        }
        if (notReturnStmts.length < 1) {
            return;
        }
        const returnStatement = new StatementBuilder("returnStatement", "return;", null, this.exit.scopeID);
        if (notReturnStmts.length == 1 && !(notReturnStmts[0] instanceof ConditionStatementBuilder)) {
            const notReturnStmt = notReturnStmts[0];
            notReturnStmt.next = returnStatement;
            returnStatement.lasts = [notReturnStmt];
            returnStatement.next = this.exit;
            this.exit.lasts[this.exit.lasts.indexOf(notReturnStmt)] = returnStatement;
            (_a = notReturnStmt.block) === null || _a === void 0 ? void 0 : _a.stms.push(returnStatement);
            returnStatement.block = notReturnStmt.block;
        }
        else {
            let returnBlock = new Block(this.blocks.length, [returnStatement], null);
            returnStatement.block = returnBlock;
            this.blocks.push(returnBlock);
            for (const notReturnStmt of notReturnStmts) {
                notReturnStmt.next = returnStatement;
                returnStatement.lasts.push(notReturnStmt);
                returnStatement.next = this.exit;
                this.exit.lasts[this.exit.lasts.indexOf(notReturnStmt)] = returnStatement;
                (_b = notReturnStmt.block) === null || _b === void 0 ? void 0 : _b.nexts.add(returnBlock);
            }
        }
    }
    nodeHaveCall(node) {
        if (node.kind == "CallExpression" || node.kind == "NewExpression") {
            return true;
        }
        let haveCall = false;
        for (let child of node.children) {
            if (child.kind == "Block")
                continue;
            haveCall = haveCall || this.nodeHaveCall(child);
        }
        return haveCall;
    }
    buildLastAndHaveCall(stm) {
        var _a;
        if (stm.walked)
            return;
        stm.walked = true;
        if (stm.astNode) {
            stm.haveCall = this.nodeHaveCall(stm.astNode);
            stm.line = stm.astNode.line + 1; // ast的行号是从0开始
            stm.column = stm.astNode.character + 1;
        }
        if (stm.type == "ifStatement" || stm.type == "loopStatement" || stm.type == "catchOrNot") {
            let cstm = stm;
            if (cstm.nextT == null || cstm.nextF == null) {
                this.errorTest(cstm);
                return;
            }
            cstm.nextT.lasts.push(cstm);
            cstm.nextF.lasts.push(cstm);
            this.buildLastAndHaveCall(cstm.nextT);
            this.buildLastAndHaveCall(cstm.nextF);
        }
        else if (stm.type == "switchStatement") {
            let sstm = stm;
            for (let s of sstm.nexts) {
                s.lasts.push(sstm);
                this.buildLastAndHaveCall(s);
            }
        }
        else if (stm.type == "tryStatement") {
            let trystm = stm;
            if (trystm.tryFirst) {
                this.buildLastAndHaveCall(trystm.tryFirst);
            }
            if (trystm.catchStatement) {
                this.buildLastAndHaveCall(trystm.catchStatement);
            }
            if (trystm.finallyStatement) {
                this.buildLastAndHaveCall(trystm.finallyStatement);
            }
        }
        else {
            if (stm.next) {
                (_a = stm.next) === null || _a === void 0 ? void 0 : _a.lasts.push(stm);
                this.buildLastAndHaveCall(stm.next);
            }
        }
    }
    resetWalked() {
        for (let stm of this.statementArray) {
            stm.walked = false;
        }
    }
    resetWalkedPartial(stm) {
        if (!stm.walked)
            return;
        stm.walked = false;
        if (stm.type == "ifStatement" || stm.type == "loopStatement" || stm.type == "catchOrNot") {
            let cstm = stm;
            if (cstm.nextT == null || cstm.nextF == null) {
                this.errorTest(cstm);
                return;
            }
            this.resetWalkedPartial(cstm.nextF);
            this.resetWalkedPartial(cstm.nextT);
        }
        else if (stm.type == "switchStatement") {
            let sstm = stm;
            for (let j in sstm.nexts) {
                this.resetWalkedPartial(sstm.nexts[j]);
            }
        }
        else if (stm.type == "tryStatement") {
            let trystm = stm;
            if (trystm.tryFirst) {
                this.resetWalkedPartial(trystm.tryFirst);
            }
            if (trystm.catchStatement) {
                this.resetWalkedPartial(trystm.catchStatement);
            }
            if (trystm.finallyStatement) {
                this.resetWalkedPartial(trystm.finallyStatement);
            }
        }
        else {
            if (stm.next != null)
                this.resetWalkedPartial(stm.next);
        }
    }
    CfgBuilder2Array(stm) {
        if (!stm.walked)
            return;
        stm.walked = false;
        stm.index = this.statementArray.length;
        if (!stm.type.includes(" exit"))
            this.statementArray.push(stm);
        if (stm.type == "ifStatement" || stm.type == "loopStatement" || stm.type == "catchOrNot") {
            let cstm = stm;
            if (cstm.nextT == null || cstm.nextF == null) {
                this.errorTest(cstm);
                return;
            }
            this.CfgBuilder2Array(cstm.nextF);
            this.CfgBuilder2Array(cstm.nextT);
        }
        else if (stm.type == "switchStatement") {
            let sstm = stm;
            for (let ss of sstm.nexts) {
                this.CfgBuilder2Array(ss);
            }
        }
        else if (stm.type == "tryStatement") {
            let trystm = stm;
            if (trystm.tryFirst) {
                this.CfgBuilder2Array(trystm.tryFirst);
            }
            if (trystm.catchStatement) {
                this.CfgBuilder2Array(trystm.catchStatement);
            }
            if (trystm.finallyStatement) {
                this.CfgBuilder2Array(trystm.finallyStatement);
            }
        }
        else {
            if (stm.next != null)
                this.CfgBuilder2Array(stm.next);
        }
    }
    getDotEdges(stm) {
        if (this.statementArray.length == 0)
            this.CfgBuilder2Array(this.entry);
        if (stm.walked)
            return;
        stm.walked = true;
        if (stm.type == "ifStatement" || stm.type == "loopStatement" || stm.type == "catchOrNot") {
            let cstm = stm;
            if (cstm.nextT == null || cstm.nextF == null) {
                this.errorTest(cstm);
                return;
            }
            let edge = [cstm.index, cstm.nextF.index];
            this.dotEdges.push(edge);
            edge = [cstm.index, cstm.nextT.index];
            this.dotEdges.push(edge);
            this.getDotEdges(cstm.nextF);
            this.getDotEdges(cstm.nextT);
        }
        else if (stm.type == "switchStatement") {
            let sstm = stm;
            for (let ss of sstm.nexts) {
                let edge = [sstm.index, ss.index];
                this.dotEdges.push(edge);
                this.getDotEdges(ss);
            }
        }
        else {
            if (stm.next != null) {
                let edge = [stm.index, stm.next.index];
                this.dotEdges.push(edge);
                this.getDotEdges(stm.next);
            }
        }
    }
    generateDot() {
        this.resetWalked();
        this.getDotEdges(this.entry);
        const filename = this.name + ".dot";
        let fileContent = "digraph G {\n";
        for (let stm of this.statementArray) {
            if (stm.type == "entry" || stm.type == "exit")
                fileContent += "Node" + stm.index + " [label=\"" + stm.type.replace(/"/g, '\\"') + "\"];\n";
            else
                fileContent += "Node" + stm.index + " [label=\"" + stm.code.replace(/"/g, '\\"') + "\"];\n";
        }
        for (let edge of this.dotEdges) {
            fileContent += "Node" + edge[0] + " -> " + "Node" + edge[1] + ";\n";
        }
        fileContent += "}";
        fs.writeFile(filename, fileContent, (err) => {
            if (err) {
                console.error(`Error writing to file: ${err.message}`);
            }
        });
    }
    dfsUseDef(stm, node, mode) {
        let set = new Set();
        if (mode == "use")
            set = stm.use;
        else if (mode == "def")
            set = stm.def;
        if (node.kind == "Identifier") {
            for (let v of this.variables) {
                if (v.name == node.text) {
                    set.add(v);
                    if (mode == "use") {
                        let chain = new DefUseChain(v.lastDef, stm);
                        v.defUse.push(chain);
                    }
                    else {
                        v.lastDef = stm;
                        for (let p of v.properties) {
                            p.lastDef = stm;
                        }
                    }
                    return;
                }
            }
        }
        if (node.kind == "PropertyAccessExpression") {
            for (let v of this.variables) {
                if (v.name == node.children[0].text) {
                    if (mode == "use") {
                        for (let prop of this.variables) {
                            if (prop.name == node.text) {
                                set.add(prop);
                                let chain = new DefUseChain(prop.lastDef, stm);
                                prop.defUse.push(chain);
                                if (prop.lastDef == v.lastDef) {
                                    set.add(v);
                                    chain = new DefUseChain(v.lastDef, stm);
                                    v.defUse.push(chain);
                                }
                                return;
                            }
                        }
                        set.add(v);
                        let chain = new DefUseChain(v.lastDef, stm);
                        v.defUse.push(chain);
                    }
                    else {
                        for (let v of this.variables) {
                            if (v.name == node.text) {
                                v.lastDef = stm;
                                return;
                            }
                        }
                        const property = new Variable(node.text, stm);
                        this.variables.push(property);
                        for (let v of this.variables) {
                            if (v.name == node.children[0].text) {
                                v.properties.push(property);
                                property.propOf = v;
                            }
                        }
                    }
                    return;
                }
            }
        }
        let indexOfDef = -1;
        if (node.kind == "VariableDeclaration") {
            indexOfDef = 0;
            this.dfsUseDef(stm, node.children[indexOfDef], "def");
        }
        if (node.kind == "BinaryExpression" && node.children[1].kind == "FirstAssignment") {
            indexOfDef = 0;
        }
        if (node.kind == "BinaryExpression" && node.children[1].kind == "FirstAssignment") {
            indexOfDef = 0;
        }
        for (let i = 0; i < node.children.length; i++) {
            if (i == indexOfDef)
                continue;
            let child = node.children[i];
            this.dfsUseDef(stm, child, mode);
        }
        for (let i = 0; i < node.children.length; i++) {
            let child = node.children[i];
            if (child.kind == "FirstAssignment") {
                if (i >= 2 && node.children[i - 2].kind == "ColonToken") {
                    indexOfDef = i - 3;
                    this.dfsUseDef(stm, node.children[indexOfDef], "def");
                }
                else {
                    indexOfDef = i - 1;
                    this.dfsUseDef(stm, node.children[indexOfDef], "def");
                }
            }
            if (child.kind.includes("EqualsToken") && child.kind != "EqualsEqualsToken") {
                this.dfsUseDef(stm, node.children[i - 1], "def");
            }
            else if (child.kind == "PlusPlusToken" || child.kind == "MinusMinusToken") {
                if (i == 0)
                    this.dfsUseDef(stm, node.children[i + 1], "def");
                else
                    this.dfsUseDef(stm, node.children[i - 1], "def");
            }
        }
    }
    findChildIndex(node, kind) {
        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i].kind == kind)
                return i;
        }
        return -1;
    }
    generateUseDef() {
        var _a, _b;
        for (let stm of this.statementArray) {
            if (stm.astNode == null)
                continue;
            let node = stm.astNode;
            let c = stm.astNode;
            switch ((_a = stm.astNode) === null || _a === void 0 ? void 0 : _a.kind) {
                case "FirstStatement":
                case "VariableStatement":
                    let declList = c.children[this.findChildIndex(c, "VariableDeclarationList")];
                    declList = declList.children[this.findChildIndex(declList, "SyntaxList")];
                    for (let decl of declList.children) {
                        if (decl.children[0]) {
                            const v = new Variable((_b = decl.children[0]) === null || _b === void 0 ? void 0 : _b.text, stm);
                            this.variables.push(v);
                            this.dfsUseDef(stm, decl, "use");
                        }
                    }
                    break;
                case "ImportDeclaration":
                    let importClause = c.children[this.findChildIndex(c, "ImportClause")];
                    let nameImport = importClause.children[0];
                    if (nameImport.kind == "NamedImports") {
                        let syntaxList = nameImport.children[this.findChildIndex(nameImport, "SyntaxList")];
                        for (let importSpecifier of syntaxList.children) {
                            if (importSpecifier.kind != "ImportSpecifier")
                                continue;
                            const v = new Variable(importSpecifier.text, stm);
                            this.variables.push(v);
                            stm.def.add(v);
                        }
                    }
                    else if (nameImport.kind == "NamespaceImport") {
                        let identifier = nameImport.children[this.findChildIndex(nameImport, "Identifier")];
                        const v = new Variable(identifier.text, stm);
                        this.variables.push(v);
                        stm.def.add(v);
                    }
                    break;
                case "IfStatement":
                case "WhileStatement":
                case "DoStatement":
                    for (let child of node.children) {
                        if (child.kind == "Identifier") {
                            for (let v of this.variables) {
                                if (v.name == child.text)
                                    stm.use.add(v);
                            }
                        }
                        else if (child.kind == "BinaryExpression") {
                            this.dfsUseDef(stm, child, "use");
                        }
                    }
                    break;
                case "ForStatement":
                    let semicolon = 0;
                    let beforeDef = new Set;
                    for (let child of node.children) {
                        if (child.kind == "SemicolonToken") {
                            semicolon++;
                            if (semicolon == 2) {
                                beforeDef = new Set(stm.def);
                            }
                        }
                        if (child.kind == "Block") {
                            break;
                        }
                        this.dfsUseDef(stm, child, "use");
                    }
                    for (let element of stm.def) {
                        if (!beforeDef.has(element)) {
                            stm.defspecial.add(element);
                        }
                    }
                    break;
                case "ForInStatement":
                    let indexOfIn = this.findChildIndex(node, "InKeyword");
                    this.dfsUseDef(stm, node.children[indexOfIn + 1], "use");
                    this.dfsUseDef(stm, node.children[indexOfIn - 1], "use");
                    break;
                case "ForOfStatement":
                    let indexOfOf = this.findChildIndex(node, "LastContextualKeyword"); //of
                    this.dfsUseDef(stm, node.children[indexOfOf + 1], "use");
                    this.dfsUseDef(stm, node.children[indexOfOf - 1], "use");
                    break;
                default:
                    if (stm.type != "entry" && stm.type != "exit")
                        this.dfsUseDef(stm, node, "use");
            }
        }
    }
    // utils begin
    getChild(node, childKind) {
        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i].kind == childKind)
                return node.children[i];
        }
        return null;
    }
    needExpansion(node) {
        let nodeKind = node.kind;
        if (nodeKind == 'PropertyAccessExpression' || nodeKind == 'CallExpression') {
            return true;
        }
        return false;
    }
    support(node) {
        let nodeKind = node.kind;
        if (nodeKind == 'ImportDeclaration' || nodeKind == 'TypeAliasDeclaration') {
            return false;
        }
        return true;
    }
    getSyntaxListItems(node) {
        let items = [];
        for (const child of node.children) {
            if (child.kind != 'CommaToken') {
                items.push(child);
            }
        }
        return items;
    }
    // temp function
    nopStmt(node) {
        let nodeKind = node.kind;
        if (nodeKind == 'BinaryExpression' || nodeKind == 'VoidExpression') {
            return true;
        }
        return false;
    }
    shouldBeConstant(node) {
        let nodeKind = node.kind;
        if (nodeKind == 'FirstTemplateToken' ||
            (nodeKind.includes('Literal') && nodeKind != 'ArrayLiteralExpression' && nodeKind != 'ObjectLiteralExpression') ||
            nodeKind == 'NullKeyword' || nodeKind == 'TrueKeyword' || nodeKind == 'FalseKeyword') {
            return true;
        }
        return false;
    }
    getOriginalLocal(local, addToLocal = true) {
        let oriName = local.getName();
        for (const oriLocal of this.locals) {
            if (oriLocal.getName() == oriName) {
                return oriLocal;
            }
        }
        if (addToLocal) {
            this.locals.add(local);
        }
        return local;
    }
    // utils end
    generateTempValue() {
        let tempLeftOpName = "$temp" + this.tempVariableNum;
        this.tempVariableNum++;
        let tempLeftOp = new Local(tempLeftOpName);
        this.locals.add(tempLeftOp);
        return tempLeftOp;
    }
    generateAssignStmt(node) {
        let leftOp = this.generateTempValue();
        let rightOp;
        if (node instanceof NodeA) {
            rightOp = this.astNodeToValue(node);
        }
        else {
            rightOp = node;
        }
        this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(leftOp, rightOp));
        return leftOp;
    }
    objectLiteralNodeToLocal(objectLiteralNode) {
        let anonymousClassName = 'AnonymousClass$' + this.name + '$' + this.anonymousClassIndex;
        this.anonymousClassIndex++;
        // TODO: 解析类体
        let arkClass = new ArkClass();
        arkClass.setName(anonymousClassName);
        let arkFile = this.declaringClass.getDeclaringArkFile();
        arkClass.setDeclaringArkFile(arkFile);
        arkClass.setLine(objectLiteralNode.line + 1);
        arkClass.setColumn(objectLiteralNode.character + 1);
        arkClass.genSignature();
        arkFile.addArkClass(arkClass);
        const classSignature = arkClass.getSignature();
        const classType = new ClassType(classSignature);
        let newExpr = new ArkNewExpr(classType);
        let tempObj = this.generateAssignStmt(newExpr);
        let methodSubSignature = new MethodSubSignature();
        methodSubSignature.setMethodName('constructor');
        let methodSignature = new MethodSignature();
        methodSignature.setDeclaringClassSignature(classSignature);
        methodSignature.setMethodSubSignature(methodSubSignature);
        let args = [];
        this.current3ACstm.threeAddressStmts.push(new ArkInvokeStmt(new ArkInstanceInvokeExpr(tempObj, methodSignature, args)));
        return tempObj;
    }
    templateSpanNodeToValue(templateSpanExprNode) {
        let exprNode = templateSpanExprNode.children[0];
        let expr = this.astNodeToValue(exprNode);
        let literalNode = templateSpanExprNode.children[1];
        let oriLiteralText = literalNode.text;
        let literalText = '';
        if (literalNode.kind == 'TemplateMiddle') {
            literalText = oriLiteralText.substring(1, oriLiteralText.length - 2);
        }
        else {
            literalText = oriLiteralText.substring(1, oriLiteralText.length - 1);
        }
        if (literalText.length == 0) {
            return expr;
        }
        let combinationExpr = new ArkBinopExpr(expr, new Constant(literalText, StringType.getInstance()), '+');
        return this.generateAssignStmt(combinationExpr);
    }
    astNodeToTemplateExpr(templateExprNode) {
        let subValues = [];
        let templateHeadNode = templateExprNode.children[0];
        let templateHeadText = templateHeadNode.text;
        subValues.push(new Constant(templateHeadText.substring(1, templateHeadText.length - 2), StringType.getInstance()));
        let syntaxListNode = templateExprNode.children[1];
        for (const child of syntaxListNode.children) {
            subValues.push(this.templateSpanNodeToValue(child));
        }
        let combinationExpr = new ArkBinopExpr(subValues[0], subValues[1], '+');
        let prevCombination = this.generateAssignStmt(combinationExpr);
        for (let i = 2; i < subValues.length; i++) {
            combinationExpr = new ArkBinopExpr(prevCombination, subValues[i], '+');
            prevCombination = this.generateAssignStmt(combinationExpr);
        }
        return prevCombination;
    }
    // TODO:支持更多场景
    astNodeToConditionExpr(conditionExprNode) {
        let conditionValue = this.astNodeToValue(conditionExprNode);
        let conditionExpr;
        if ((conditionValue instanceof ArkBinopExpr) && isRelationalOperator(conditionValue.getOperator())) {
            conditionExpr = new ArkConditionExpr(conditionValue.getOp1(), conditionValue.getOp2(), flipOperator(conditionValue.getOperator()));
        }
        else {
            if (IRUtils.moreThanOneAddress(conditionValue)) {
                conditionValue = this.generateAssignStmt(conditionValue);
            }
            conditionExpr = new ArkConditionExpr(conditionValue, new Constant('0', NumberType.getInstance()), '==');
        }
        return conditionExpr;
        function isRelationalOperator(operator) {
            return operator == '<' || operator == '<=' || operator == '>' || operator == '>=' ||
                operator == '==' || operator == '===' || operator == '!=' || operator == '!==';
        }
        function flipOperator(operator) {
            let newOperater = '';
            switch (operator) {
                case '<':
                    newOperater = '>=';
                    break;
                case '<=':
                    newOperater = '>';
                    break;
                case '>':
                    newOperater = '<=';
                    break;
                case '>=':
                    newOperater = '<';
                    break;
                case '==':
                    newOperater = '!=';
                    break;
                case '===':
                    newOperater = '!==';
                    break;
                case '!=':
                    newOperater = '==';
                    break;
                case '!==':
                    newOperater = '===';
                    break;
            }
            return newOperater;
        }
    }
    astNodeToValue(node) {
        let value;
        if (node.kind == 'Identifier' || node.kind == 'ThisKeyword' || node.kind == 'SuperKeyword') {
            // TODO:识别外部变量
            value = new Local(node.text);
            value = this.getOriginalLocal(value);
        }
        else if (node.kind == 'Parameter') {
            let identifierNode = node.children[0];
            node.children[2];
            value = new Local(identifierNode.text);
            value = this.getOriginalLocal(value);
        }
        else if (this.shouldBeConstant(node)) {
            const typeStr = this.resolveKeywordType(node);
            let constant = new Constant(node.text, TypeInference.buildTypeFromStr(typeStr));
            value = this.generateAssignStmt(constant);
        }
        else if (node.kind == 'BinaryExpression') {
            let op1 = this.astNodeToValue(node.children[0]);
            let operator = node.children[1].text;
            let op2 = this.astNodeToValue(node.children[2]);
            if (IRUtils.moreThanOneAddress(op1)) {
                op1 = this.generateAssignStmt(op1);
            }
            if (IRUtils.moreThanOneAddress(op2)) {
                op2 = this.generateAssignStmt(op2);
            }
            value = new ArkBinopExpr(op1, op2, operator);
        }
        // TODO:属性访问需要展开
        else if (node.kind == 'PropertyAccessExpression') {
            let baseValue = this.astNodeToValue(node.children[0]);
            if (IRUtils.moreThanOneAddress(baseValue)) {
                baseValue = this.generateAssignStmt(baseValue);
            }
            let base = baseValue;
            let fieldName = node.children[2].text;
            const fieldSignature = new FieldSignature();
            fieldSignature.setFieldName(fieldName);
            value = new ArkInstanceFieldRef(base, fieldSignature);
        }
        else if (node.kind == 'ElementAccessExpression') {
            let baseValue = this.astNodeToValue(node.children[0]);
            if (!(baseValue instanceof Local)) {
                baseValue = this.generateAssignStmt(baseValue);
            }
            let elementNodeIdx = this.findChildIndex(node, 'OpenBracketToken') + 1;
            let elementValue = this.astNodeToValue(node.children[elementNodeIdx]);
            if (IRUtils.moreThanOneAddress(elementValue)) {
                elementValue = this.generateAssignStmt(elementValue);
            }
            // temp
            if (elementValue instanceof Constant) {
                if (elementValue.getValue().startsWith('\'')) {
                    let oldValue = elementValue.getValue();
                    elementValue.setValue(oldValue.substring(1, oldValue.length - 1));
                }
                else if (elementValue.getValue().startsWith('"')) {
                    let oldValue = elementValue.getValue();
                    elementValue.setValue(oldValue.substring(2, oldValue.length - 2));
                }
            }
            let baseLocal = baseValue;
            if (baseLocal.getType() instanceof ArrayType) {
                value = new ArkArrayRef(baseLocal, elementValue);
            }
            else {
                let fieldName = elementValue.toString();
                const fieldSignature = new FieldSignature();
                fieldSignature.setFieldName(fieldName);
                value = new ArkInstanceFieldRef(baseLocal, fieldSignature);
            }
        }
        else if (node.kind == "CallExpression") {
            let syntaxListNode = node.children[this.findChildIndex(node, 'OpenParenToken') + 1];
            let argNodes = this.getSyntaxListItems(syntaxListNode);
            let args = [];
            for (const argNode of argNodes) {
                let argValue = this.astNodeToValue(argNode);
                if (IRUtils.moreThanOneAddress(argValue)) {
                    argValue = this.generateAssignStmt(argValue);
                }
                args.push(argValue);
            }
            let calleeNode = node.children[0];
            let methodValue = this.astNodeToValue(calleeNode);
            let classSignature = new ClassSignature();
            let methodSubSignature = new MethodSubSignature();
            let methodSignature = new MethodSignature();
            methodSignature.setDeclaringClassSignature(classSignature);
            methodSignature.setMethodSubSignature(methodSubSignature);
            if (methodValue instanceof ArkInstanceFieldRef) {
                let methodName = methodValue.getFieldName();
                let base = methodValue.getBase();
                methodSubSignature.setMethodName(methodName);
                value = new ArkInstanceInvokeExpr(base, methodSignature, args);
            }
            else if (methodValue instanceof ArkStaticFieldRef) {
                methodSubSignature.setMethodName(methodValue.getFieldName());
                value = new ArkStaticInvokeExpr(methodSignature, args);
            }
            else {
                methodSubSignature.setMethodName(calleeNode.text);
                value = new ArkStaticInvokeExpr(methodSignature, args);
            }
        }
        else if (node.kind == "ArrowFunction") {
            let arrowFuncName = 'AnonymousFunc$' + this.name + '$' + this.anonymousFuncIndex;
            if (node.methodNodeInfo) {
                node.methodNodeInfo.updateName4anonymousFunc(arrowFuncName);
            }
            else {
                throw new Error('No MethodNodeInfo found for ArrowFunction node. Please check.');
            }
            this.anonymousFuncIndex++;
            let argsNode = node.children[1];
            let args = [];
            for (let argNode of argsNode.children) {
                if (argNode.kind != 'CommaToken') {
                    args.push(this.astNodeToValue(argNode));
                }
            }
            let arrowArkMethod = new ArkMethod();
            buildArkMethodFromArkClass(node, this.declaringClass, arrowArkMethod);
            arrowArkMethod.genSignature();
            this.declaringClass.addMethod(arrowArkMethod);
            let callableType = new CallableType(arrowArkMethod.getSignature());
            value = new Local(arrowFuncName, callableType);
            this.locals.add(value);
        }
        // TODO:函数表达式视作静态方法还是普通方法
        else if (node.kind == 'FunctionExpression') {
            let funcExprName = '';
            if (node.children[1].kind != 'OpenParenToken') {
                funcExprName = node.children[1].text;
            }
            else {
                funcExprName = 'AnonymousFunc-' + this.name + '-' + this.anonymousFuncIndex;
                this.anonymousFuncIndex++;
            }
            if (node.methodNodeInfo) {
                node.methodNodeInfo.updateName4anonymousFunc(funcExprName);
            }
            else {
                throw new Error('No MethodNodeInfo found for ArrowFunction node. Please check.');
            }
            let argsNode = this.getChild(node, 'SyntaxList');
            let args = [];
            for (let argNode of argsNode.children) {
                if (argNode.kind != 'CommaToken') {
                    args.push(this.astNodeToValue(argNode));
                }
            }
            let exprArkMethod = new ArkMethod();
            buildArkMethodFromArkClass(node, this.declaringClass, exprArkMethod);
            exprArkMethod.genSignature();
            this.declaringClass.addMethod(exprArkMethod);
            let callableType = new CallableType(exprArkMethod.getSignature());
            value = new Local(funcExprName, callableType);
            this.locals.add(value);
        }
        else if (node.kind == "ClassExpression") {
            let cls = new ArkClass();
            let arkFile = this.declaringClass.getDeclaringArkFile();
            buildNormalArkClassFromArkFile(node, arkFile, cls);
            arkFile.addArkClass(cls);
            if (cls.isExported()) {
                let exportClauseName = cls.getName();
                let exportClauseType = "Class";
                let exportInfo = new ExportInfo();
                exportInfo.build(exportClauseName, exportClauseType);
                arkFile.addExportInfos(exportInfo);
            }
            value = new Local(cls.getName(), new ClassType(cls.getSignature()));
        }
        else if (node.kind == "ObjectLiteralExpression") {
            value = this.objectLiteralNodeToLocal(node);
        }
        else if (node.kind == "NewExpression") {
            const className = node.children[1].text;
            if (className == 'Array') {
                let baseType = AnyType.getInstance();
                if (this.findChildIndex(node, 'FirstBinaryOperator') != -1) {
                    const baseTypeNode = node.children[this.findChildIndex(node, 'FirstBinaryOperator') + 1];
                    baseType = this.getTypeNode(baseTypeNode);
                }
                let size = 0;
                let sizeValue = null;
                const argSyntaxListNode = node.children[this.findChildIndex(node, 'OpenParenToken') + 1];
                const argNodes = this.getSyntaxListItems(argSyntaxListNode);
                const items = [];
                if (argNodes.length == 1 && argNodes[0].kind == 'FirstLiteralToken') {
                    size = parseInt(argNodes[0].text);
                }
                else if (argNodes.length == 1 && argNodes[0].kind == 'Identifier') {
                    size = -1;
                    sizeValue = this.getOriginalLocal(new Local(argNodes[0].text), false);
                }
                else if (argNodes.length >= 1) {
                    size = argNodes.length;
                    if (baseType == AnyType.getInstance()) {
                        baseType = TypeInference.buildTypeFromStr(this.resolveKeywordType(argNodes[0]));
                    }
                    for (const sizeNode of argNodes) {
                        items.push(new Constant(sizeNode.text, baseType));
                    }
                }
                if (sizeValue == null) {
                    sizeValue = new Constant(size.toString(), NumberType.getInstance());
                }
                let newArrayExpr = new ArkNewArrayExpr(baseType, sizeValue);
                value = this.generateAssignStmt(newArrayExpr);
                value.setType(new ArrayObjectType(baseType, 1));
                for (let index = 0; index < items.length; index++) {
                    let arrayRef = new ArkArrayRef(value, new Constant(index.toString(), NumberType.getInstance()));
                    const arrayItem = items[index];
                    this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(arrayRef, arrayItem));
                }
            }
            else {
                let classSignature = new ClassSignature();
                classSignature.setClassName(className);
                const classType = new ClassType(classSignature);
                let newExpr = new ArkNewExpr(classType);
                value = this.generateAssignStmt(newExpr);
                let methodSubSignature = new MethodSubSignature();
                methodSubSignature.setMethodName('constructor');
                let methodSignature = new MethodSignature();
                methodSignature.setDeclaringClassSignature(classSignature);
                methodSignature.setMethodSubSignature(methodSubSignature);
                let syntaxListNode = node.children[this.findChildIndex(node, 'OpenParenToken') + 1];
                let argNodes = this.getSyntaxListItems(syntaxListNode);
                let args = [];
                for (const argNode of argNodes) {
                    args.push(this.astNodeToValue(argNode));
                }
                this.current3ACstm.threeAddressStmts.push(new ArkInvokeStmt(new ArkInstanceInvokeExpr(value, methodSignature, args)));
            }
        }
        else if (node.kind == 'ArrayLiteralExpression') {
            let syntaxListNode = node.children[1];
            let size = 0;
            for (const syntaxNode of syntaxListNode.children) {
                if (syntaxNode.kind != 'CommaToken') {
                    size += 1;
                }
            }
            let newArrayExpr = new ArkNewArrayExpr(UnknownType.getInstance(), new Constant(size.toString(), NumberType.getInstance()));
            value = this.generateAssignStmt(newArrayExpr);
            const itemTypes = new Set();
            let argsNode = node.children[1];
            let index = 0;
            for (let argNode of argsNode.children) {
                if (argNode.kind != 'CommaToken') {
                    let arrayRef = new ArkArrayRef(value, new Constant(index.toString(), NumberType.getInstance()));
                    const itemTypeStr = this.resolveKeywordType(argNode);
                    const itemType = TypeInference.buildTypeFromStr(itemTypeStr);
                    const arrayItem = new Constant(argNode.text, itemType);
                    itemTypes.add(itemType);
                    this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(arrayRef, arrayItem));
                    index++;
                }
            }
            if (itemTypes.size == 1) {
                newArrayExpr.setBaseType(itemTypes.keys().next().value);
            }
            else if (itemTypes.size > 1) {
                newArrayExpr.setBaseType(new UnionType(Array.from(itemTypes.keys())));
            }
            value.setType(new ArrayType(newArrayExpr.getBaseType(), 1));
        }
        else if (node.kind == 'PrefixUnaryExpression') {
            let token = node.children[0].text;
            if (token == '++' || token == '--') {
                value = this.astNodeToValue(node.children[1]);
                let binopExpr = new ArkBinopExpr(value, new Constant('1', NumberType.getInstance()), token[0]);
                this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(value, binopExpr));
            }
            else {
                let op = this.astNodeToValue(node.children[1]);
                let arkUnopExpr = new ArkUnopExpr(op, token);
                value = this.generateAssignStmt(arkUnopExpr);
            }
        }
        else if (node.kind == 'PostfixUnaryExpression') {
            let token = node.children[1].text;
            value = this.astNodeToValue(node.children[0]);
            let binopExpr = new ArkBinopExpr(value, new Constant('1', NumberType.getInstance()), token[0]);
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(value, binopExpr));
        }
        else if (node.kind == 'TemplateExpression') {
            value = this.astNodeToTemplateExpr(node);
        }
        else if (node.kind == 'AwaitExpression') {
            value = this.astNodeToValue(node.children[1]);
        }
        else if (node.kind == 'ParenthesizedExpression') {
            const parenthesizedValue = this.astNodeToValue(node.children[1]);
            value = this.generateAssignStmt(parenthesizedValue);
        }
        else if (node.kind == 'SpreadElement') {
            value = this.astNodeToValue(node.children[1]);
        }
        else if (node.kind == 'TypeOfExpression') {
            value = new ArkTypeOfExpr(this.astNodeToValue(node.children[1]));
        }
        else if (node.kind == 'AsExpression') {
            let typeName = node.children[2].text;
            let op = this.astNodeToValue(node.children[0]);
            value = new ArkCastExpr(op, TypeInference.buildTypeFromStr(typeName));
        }
        else if (node.kind == 'TypeAssertionExpression') {
            let typeName = node.children[this.findChildIndex(node, 'FirstBinaryOperator') + 1].text;
            let opNode = node.children[this.findChildIndex(node, 'GreaterThanToken') + 1];
            let op = this.astNodeToValue(opNode);
            value = new ArkCastExpr(op, TypeInference.buildTypeFromStr(typeName));
        }
        else if (node.kind == 'ArrayBindingPattern' || node.kind == 'ObjectBindingPattern') {
            value = this.generateTempValue();
        }
        else if (node.kind == 'VoidExpression') {
            this.astNodeToThreeAddressStmt(node.children[1]);
            value = new Constant('undefined', UndefinedType.getInstance());
        }
        else if (node.kind == 'VariableDeclarationList') {
            let declsNode = node.children[this.findChildIndex(node, "SyntaxList")];
            let syntaxListItems = this.getSyntaxListItems(declsNode);
            value = new Local(syntaxListItems[0].text);
            value = this.getOriginalLocal(value);
        }
        else if (node.kind == 'ConditionalExpression') {
            // TODO:新增block
            let conditionIdx = this.findChildIndex(node, 'QuestionToken') - 1;
            let conditionExprNode = node.children[conditionIdx];
            let conditionExpr = this.astNodeToConditionExpr(conditionExprNode);
            this.current3ACstm.threeAddressStmts.push(new ArkIfStmt(conditionExpr));
            let resultLocal = this.generateTempValue();
            let whenTrueIdx = this.findChildIndex(node, 'QuestionToken') + 1;
            let whenTrueNode = node.children[whenTrueIdx];
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(resultLocal, this.astNodeToValue(whenTrueNode)));
            let whenFalseIdx = this.findChildIndex(node, 'ColonToken') + 1;
            let whenFalseNode = node.children[whenFalseIdx];
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(resultLocal, this.astNodeToValue(whenFalseNode)));
            value = resultLocal;
        }
        else if (node.kind == 'NonNullExpression') {
            value = this.astNodeToValue(node.children[0]);
        }
        else {
            value = new Constant(node.text);
        }
        return value;
    }
    astNodeToCompoundAssignment(node) {
        let operator = node.children[1].text;
        if (!isCompoundAssignment(operator)) {
            return [];
        }
        let stmts = [];
        let leftOpNode = node.children[0];
        let leftOp = this.astNodeToValue(leftOpNode);
        let rightOpNode = node.children[2];
        let rightOp = this.astNodeToValue(rightOpNode);
        if (IRUtils.moreThanOneAddress(leftOp) && IRUtils.moreThanOneAddress(rightOp)) {
            rightOp = this.generateAssignStmt(rightOp);
        }
        stmts.push(new ArkAssignStmt(leftOp, new ArkBinopExpr(leftOp, rightOp, operator.substring(0, operator.length - 1))));
        return stmts;
        function isCompoundAssignment(operator) {
            return operator == '+=' || operator == '-=' || operator == '*=' || operator == '**=' ||
                operator == '/=' || operator == '%=' || operator == '>>=' || operator == '>>>=' ||
                operator == '<<=';
        }
    }
    astNodeToThreeAddressAssignStmt(node) {
        let leftOpNode = node.children[0];
        let leftOp = this.astNodeToValue(leftOpNode);
        let leftOpType = this.getTypeNode(node);
        let rightOpNode = new NodeA(undefined, null, [], 'dummy', -1, 'dummy');
        let rightOp;
        if (this.findChildIndex(node, 'FirstAssignment') != -1) {
            rightOpNode = node.children[this.findChildIndex(node, 'FirstAssignment') + 1];
            rightOp = this.astNodeToValue(rightOpNode);
        }
        else {
            rightOp = new Constant('undefined', UndefinedType.getInstance());
        }
        if (leftOp instanceof Local) {
            leftOp.setType(leftOpType);
        }
        if (IRUtils.moreThanOneAddress(leftOp) && IRUtils.moreThanOneAddress(rightOp)) {
            rightOp = this.generateAssignStmt(rightOp);
        }
        let threeAddressAssignStmts = [];
        threeAddressAssignStmts.push(new ArkAssignStmt(leftOp, rightOp));
        TypeInference.inferTypeInStmt(threeAddressAssignStmts[0], null);
        if (leftOpNode.kind == 'ArrayBindingPattern' || leftOpNode.kind == 'ObjectBindingPattern') {
            let argNodes = this.getSyntaxListItems(leftOpNode.children[1]);
            let index = 0;
            for (const argNode of argNodes) {
                // TODO:数组条目类型
                let arrayRef = new ArkArrayRef(leftOp, new Constant(index.toString(), NumberType.getInstance()));
                let arrayItem = new Constant(argNode.text);
                threeAddressAssignStmts.push(new ArkAssignStmt(arrayItem, arrayRef));
                index++;
            }
        }
        return threeAddressAssignStmts;
    }
    astNodeToThreeAddressSwitchStatement(switchAstNode) {
        let exprNode = switchAstNode.children[this.findChildIndex(switchAstNode, 'OpenParenToken') + 1];
        let exprValue = this.astNodeToValue(exprNode);
        if (IRUtils.moreThanOneAddress(exprValue)) {
            exprValue = this.generateAssignStmt(exprValue);
        }
        let caseBlockNode = switchAstNode.children[this.findChildIndex(switchAstNode, 'CloseParenToken') + 1];
        let syntaxList = caseBlockNode.children[1];
        let caseValues = [];
        for (const caseNode of syntaxList.children) {
            if (caseNode.kind == 'DefaultClause') {
                continue;
            }
            let caseExprNode = caseNode.children[1];
            let caseExprValue = this.astNodeToValue(caseExprNode);
            if (IRUtils.moreThanOneAddress(caseExprValue)) {
                caseExprValue = this.generateAssignStmt(caseExprValue);
            }
            caseValues.push(caseExprValue);
        }
        this.current3ACstm.threeAddressStmts.push(new ArkSwitchStmt(exprValue, caseValues));
    }
    astNodeToThreeAddressIterationStatement(node) {
        if (node.kind == "ForStatement") {
            let openParenTokenIdx = this.findChildIndex(node, 'OpenParenToken');
            let mayConditionIdx = openParenTokenIdx + 3;
            if (node.children[openParenTokenIdx + 1].kind != 'SemicolonToken') {
                let initializer = node.children[openParenTokenIdx + 1];
                this.astNodeToThreeAddressStmt(initializer);
            }
            else {
                mayConditionIdx = openParenTokenIdx + 2;
            }
            let incrementorIdx = mayConditionIdx + 2;
            if (node.children[mayConditionIdx].kind != 'SemicolonToken') {
                let conditionExprNode = node.children[mayConditionIdx];
                let conditionExpr = this.astNodeToConditionExpr(conditionExprNode);
                this.current3ACstm.threeAddressStmts.push(new ArkIfStmt(conditionExpr));
            }
            else {
                incrementorIdx = mayConditionIdx + 1;
            }
            if (node.children[incrementorIdx].kind != 'SemicolonToken') {
                let incrementorNode = node.children[incrementorIdx];
                this.astNodeToThreeAddressStmt(incrementorNode);
            }
        }
        else if (node.kind == "ForOfStatement") {
            // 暂时只支持数组遍历
            let varIdx = this.findChildIndex(node, 'OpenParenToken') + 1;
            let varNode = node.children[varIdx];
            let iterableIdx = varIdx + 2;
            let iterableNode = node.children[iterableIdx];
            let iterableValue = this.astNodeToValue(iterableNode);
            let lenghtLocal = this.generateTempValue();
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(lenghtLocal, new ArkLengthExpr(iterableValue)));
            let indexLocal = this.generateTempValue();
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(indexLocal, new Constant('0', NumberType.getInstance())));
            let varLocal = this.astNodeToValue(varNode);
            let arrayRef = new ArkArrayRef(iterableValue, indexLocal);
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(varLocal, arrayRef));
            let conditionExpr = new ArkConditionExpr(indexLocal, lenghtLocal, ' >= ');
            this.current3ACstm.threeAddressStmts.push(new ArkIfStmt(conditionExpr));
            let incrExpr = new ArkBinopExpr(indexLocal, new Constant('1', NumberType.getInstance()), '+');
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(indexLocal, incrExpr));
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(varLocal, arrayRef));
        }
        else if (node.kind == "ForInStatement") {
            // 暂时只支持数组遍历
            let varIdx = this.findChildIndex(node, 'OpenParenToken') + 1;
            let varNode = node.children[varIdx];
            let iterableIdx = varIdx + 2;
            let iterableNode = node.children[iterableIdx];
            let iterableValue = this.astNodeToValue(iterableNode);
            let lenghtLocal = this.generateTempValue();
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(lenghtLocal, new ArkLengthExpr(iterableValue)));
            let indexLocal = this.generateTempValue();
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(indexLocal, new Constant('0', NumberType.getInstance())));
            let varLocal = this.astNodeToValue(varNode);
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(varLocal, indexLocal));
            let conditionExpr = new ArkConditionExpr(indexLocal, lenghtLocal, ' >= ');
            this.current3ACstm.threeAddressStmts.push(new ArkIfStmt(conditionExpr));
            let incrExpr = new ArkBinopExpr(indexLocal, new Constant('1', NumberType.getInstance()), '+');
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(indexLocal, incrExpr));
            this.current3ACstm.threeAddressStmts.push(new ArkAssignStmt(varLocal, indexLocal));
        }
        else if (node.kind == "WhileStatement" || node.kind == "DoStatement") {
            let conditionIdx = this.findChildIndex(node, 'OpenParenToken') + 1;
            let conditionExprNode = node.children[conditionIdx];
            let conditionExpr = this.astNodeToConditionExpr(conditionExprNode);
            this.current3ACstm.threeAddressStmts.push(new ArkIfStmt(conditionExpr));
        }
    }
    astNodeToThreeAddressStmt(node) {
        let threeAddressStmts = [];
        if (node.kind == "ReturnStatement") {
            let childCnt = node.children.length;
            if (childCnt > 1 && node.children[1].kind != 'SemicolonToken') {
                let op = this.astNodeToValue(node.children[1]);
                if (IRUtils.moreThanOneAddress(op)) {
                    op = this.generateAssignStmt(op);
                }
                threeAddressStmts.push(new ArkReturnStmt(op));
            }
            else {
                threeAddressStmts.push(new ArkReturnVoidStmt());
            }
        }
        else if (node.kind == "FirstStatement" || node.kind == "VariableDeclarationList") {
            let declListNode = node;
            if (node.kind == 'FirstStatement') {
                declListNode = node.children[this.findChildIndex(node, "VariableDeclarationList")];
            }
            let declsNode = declListNode.children[this.findChildIndex(declListNode, "SyntaxList")];
            let syntaxListItems = this.getSyntaxListItems(declsNode);
            for (let declNode of syntaxListItems) {
                this.astNodeToThreeAddressStmt(declNode);
            }
        }
        else if ((node.kind == 'BinaryExpression' && node.children[1].kind == 'FirstAssignment')
            || (node.kind == 'VariableDeclaration')) {
            threeAddressStmts.push(...this.astNodeToThreeAddressAssignStmt(node));
        }
        else if ((node.kind == 'BinaryExpression')) {
            threeAddressStmts.push(...this.astNodeToCompoundAssignment(node));
        }
        else if (node.kind == "ExpressionStatement") {
            let expressionNodeIdx = 0;
            if (node.children[0].kind == 'JSDocComment') {
                expressionNodeIdx = 1;
            }
            let expressionNode = node.children[expressionNodeIdx];
            this.astNodeToThreeAddressStmt(expressionNode);
        }
        else if (node.kind == 'IfStatement') {
            let conditionExprNode = node.children[this.findChildIndex(node, 'OpenParenToken') + 1];
            let conditionExpr = this.astNodeToConditionExpr(conditionExprNode);
            threeAddressStmts.push(new ArkIfStmt(conditionExpr));
        }
        else if (node.kind == 'PostfixUnaryExpression' || node.kind == 'PrefixUnaryExpression') {
            this.astNodeToValue(node);
        }
        else if (node.kind == 'ForStatement' || node.kind == 'ForOfStatement' || node.kind == 'ForInStatement'
            || node.kind == 'WhileStatement' || node.kind == 'DoStatement') {
            this.astNodeToThreeAddressIterationStatement(node);
        }
        else if (node.kind == 'BreakStatement' || node.kind == 'ContinueStatement') {
            threeAddressStmts.push(new ArkGotoStmt());
        }
        else if (node.kind == 'SwitchStatement') {
            this.astNodeToThreeAddressSwitchStatement(node);
        }
        else if (node.kind == 'ThrowStatement') {
            let op = this.astNodeToValue(node.children[1]);
            if (IRUtils.moreThanOneAddress(op)) {
                op = this.generateAssignStmt(op);
            }
            threeAddressStmts.push(new ArkThrowStmt(op));
        }
        else if (node.kind == 'CatchClause') {
            let catchedValueNode = node.children[this.findChildIndex(node, 'OpenParenToken') + 1];
            let catchedValue = new Local(catchedValueNode.text);
            catchedValue = this.getOriginalLocal(catchedValue);
            let caughtExceptionRef = new ArkCaughtExceptionRef(UnknownType.getInstance());
            threeAddressStmts.push(new ArkAssignStmt(catchedValue, caughtExceptionRef));
        }
        else if (node.kind == 'CallExpression') {
            threeAddressStmts.push(new ArkInvokeStmt(this.astNodeToValue(node)));
        }
        else if (node.kind == "AwaitExpression") {
            let expressionNode = node.children[1];
            this.astNodeToThreeAddressStmt(expressionNode);
        }
        else if (node.kind == 'VoidExpression') {
            this.astNodeToThreeAddressStmt(node.children[1]);
        }
        else if (node.kind == 'DeleteExpression') {
            let popertyAccessExprNode = node.children[1];
            let popertyAccessExpr = this.astNodeToValue(popertyAccessExprNode);
            threeAddressStmts.push(new ArkDeleteStmt(popertyAccessExpr));
        }
        else if (this.nopStmt(node)) ;
        else ;
        this.current3ACstm.threeAddressStmts.push(...threeAddressStmts);
        return;
    }
    transformToThreeAddress() {
        // process parameters        
        if (this.blocks.length > 0 && this.blocks[0].stms.length > 0) { // 临时处理默认函数函数体为空的情况
            this.current3ACstm = this.blocks[0].stms[0];
            let index = 0;
            for (const methodParameter of this.declaringMethod.getParameters()) {
                let parameterRef = new ArkParameterRef(index, methodParameter.getType());
                let parameterLocal = this.generateAssignStmt(parameterRef);
                parameterLocal.setName(methodParameter.getName());
                index++;
                this.paraLocals.push(parameterLocal);
            }
            let thisRef = new ArkThisRef(this.declaringClass.getSignature().getType());
            this.thisLocal = this.generateAssignStmt(thisRef);
            this.thisLocal.setName('this');
            this.thisLocal.setType(thisRef.getType());
        }
        for (let blockId = 0; blockId < this.blocks.length; blockId++) {
            let currBlock = this.blocks[blockId];
            for (const originStmt of currBlock.stms) {
                if (originStmt.astNode && originStmt.code != "" && this.support(originStmt.astNode)) {
                    this.current3ACstm = originStmt;
                    this.astNodeToThreeAddressStmt(originStmt.astNode);
                }
                else if (originStmt.code.startsWith('return')) {
                    // 额外添加的return语句特殊处理
                    originStmt.threeAddressStmts.push(new ArkReturnVoidStmt());
                }
                else if (originStmt.type == 'gotoStatement') {
                    // 额外添加的goto语句特殊处理
                    originStmt.threeAddressStmts.push(new ArkGotoStmt());
                }
            }
        }
    }
    errorTest(stm) {
        var _a, _b;
        let mes = "";
        if ((_a = this.declaringClass) === null || _a === void 0 ? void 0 : _a.getDeclaringArkFile()) {
            mes = ((_b = this.declaringClass) === null || _b === void 0 ? void 0 : _b.getDeclaringArkFile().getName()) + "." + this.declaringClass.getName() + "." + this.name;
        }
        else {
            mes = "ifnext error";
        }
        mes += "\n" + stm.code;
        throw new textError(mes);
    }
    updateParentText(node) {
        if (!node)
            return;
        node.text = "";
        for (let child of node.children) {
            node.text += child.text;
            if (child.kind.includes("Keyword"))
                node.text += " ";
            if (node.kind == "SyntaxList" && child.kind.includes("Statement"))
                node.text += "\r\n";
        }
        if (node.parent)
            this.updateParentText(node.parent);
    }
    insertStatementAfter(stm, text) {
        var _a;
        let insertAST = new ASTree(text);
        let parent;
        if ((_a = stm.astNode) === null || _a === void 0 ? void 0 : _a.parent)
            parent = stm.astNode.parent;
        else {
            if (!this.entry.astNode) {
                logger$8.error("entry without astNode");
                process.exit();
            }
            parent = this.entry.astNode;
        }
        let insertPosition = -1;
        if (stm.astNode)
            insertPosition = parent.children.indexOf(stm.astNode) + 1;
        else
            insertPosition = parent.children.length;
        let stmAST = insertAST.root.children[0];
        parent.children.splice(insertPosition, 0, stmAST);
        stmAST.parent = parent;
        this.updateParentText(parent);
        return stmAST;
    }
    insertStatementBefore(stm, text) {
        var _a;
        let insertAST = new ASTree(text);
        let parent;
        if ((_a = stm.astNode) === null || _a === void 0 ? void 0 : _a.parent)
            parent = stm.astNode.parent;
        else {
            if (!this.entry.astNode) {
                logger$8.error("entry without astNode");
                process.exit();
            }
            parent = this.entry.astNode;
        }
        let insertPosition = -1;
        if (stm.astNode)
            insertPosition = parent.children.indexOf(stm.astNode);
        else
            insertPosition = parent.children.length;
        let stmAST = insertAST.root.children[0];
        parent.children.splice(insertPosition, 0, stmAST);
        stmAST.parent = parent;
        this.updateParentText(parent);
        return stmAST;
    }
    removeStatement(stm) {
        let astNode = stm.astNode;
        if (astNode && astNode.parent) {
            astNode.parent.children.splice(astNode.parent.children.indexOf(astNode), 1);
            this.updateParentText(astNode.parent);
        }
    }
    getStatementByText(text) {
        const ret = [];
        for (let stm of this.statementArray) {
            if (stm.code.replace(/\s/g, '') == text.replace(/\s/g, '')) {
                ret.push(stm);
            }
        }
        return ret;
    }
    stm23AC(stm) {
        if (stm.addressCode3.length > 0) {
            if (stm.type.includes("loop") || stm.type.includes("if") || stm.type.includes("switch")) {
                let last3AC = new NodeA(undefined, null, [], "temp", -1, "undefined");
                for (let i = 0; i < stm.addressCode3.length; i++) {
                    let ac = stm.addressCode3[i];
                    let temp = this.insertStatementBefore(stm, ac);
                    last3AC = temp;
                }
                if (!stm.astNode) {
                    logger$8.error("stm without ast");
                    process.exit();
                }
                let block = stm.astNode.children[this.findChildIndex(stm.astNode, "Block")];
                block.parent = last3AC;
                last3AC.children[last3AC.children.length - 1] = block;
                this.updateParentText(last3AC);
                this.removeStatement(stm);
            }
            else {
                for (let i = 0; i < stm.addressCode3.length; i++) {
                    let ac = stm.addressCode3[i];
                    this.insertStatementBefore(stm, ac);
                }
                this.removeStatement(stm);
            }
        }
    }
    simplify() {
        for (let stm of this.statementArray) {
            this.stm23AC(stm);
        }
    }
    printBlocks() {
        var _a, _b, _c, _d, _e, _f, _g;
        let text = "";
        if ((_a = this.declaringClass) === null || _a === void 0 ? void 0 : _a.getDeclaringArkFile()) {
            text += this.declaringClass.getDeclaringArkFile().getName() + "\n";
        }
        for (let bi = 0; bi < this.blocks.length; bi++) {
            let block = this.blocks[bi];
            if (bi != 0)
                text += "label" + block.id + ":\n";
            let length = block.stms.length;
            for (let i = 0; i < length; i++) {
                let stm = block.stms[i];
                if (stm.type == "ifStatement" || stm.type == "loopStatement" || stm.type == "catchOrNot") {
                    let cstm = stm;
                    if (cstm.nextT == null || cstm.nextF == null) {
                        this.errorTest(cstm);
                        return;
                    }
                    if (!cstm.nextF.block || !cstm.nextT.block) {
                        this.errorTest(cstm);
                        return;
                    }
                    stm.code = "if !(" + cstm.condition + ") goto label" + cstm.nextF.block.id;
                    if (i == length - 1 && bi + 1 < this.blocks.length && this.blocks[bi + 1].id != cstm.nextT.block.id) {
                        let gotoStm = new StatementBuilder("gotoStatement", "goto label" + cstm.nextT.block.id, null, block.stms[0].scopeID);
                        block.stms.push(gotoStm);
                        length++;
                    }
                }
                else if (stm.type == "breakStatement" || stm.type == "continueStatement") {
                    if (!((_b = stm.next) === null || _b === void 0 ? void 0 : _b.block)) {
                        this.errorTest(stm);
                        return;
                    }
                    stm.code = "goto label" + ((_c = stm.next) === null || _c === void 0 ? void 0 : _c.block.id);
                }
                else {
                    if (i == length - 1 && ((_d = stm.next) === null || _d === void 0 ? void 0 : _d.block) && (bi + 1 < this.blocks.length && this.blocks[bi + 1].id != stm.next.block.id || bi + 1 == this.blocks.length)) {
                        let gotoStm = new StatementBuilder("StatementBuilder", "goto label" + ((_e = stm.next) === null || _e === void 0 ? void 0 : _e.block.id), null, block.stms[0].scopeID);
                        block.stms.push(gotoStm);
                        length++;
                    }
                }
                if (stm.addressCode3.length == 0) {
                    text += "    " + stm.code + "\n";
                }
                else {
                    for (let ac of stm.addressCode3) {
                        if (ac.startsWith("if") || ac.startsWith("while")) {
                            let cstm = stm;
                            let condition = ac.substring(ac.indexOf("("));
                            let goto = "";
                            if ((_f = cstm.nextF) === null || _f === void 0 ? void 0 : _f.block)
                                goto = "if !" + condition + " goto label" + ((_g = cstm.nextF) === null || _g === void 0 ? void 0 : _g.block.id);
                            stm.addressCode3[stm.addressCode3.indexOf(ac)] = goto;
                            text += "    " + goto + "\n";
                        }
                        else
                            text += "    " + ac + "\n";
                    }
                }
            }
        }
        for (let cat of this.catches) {
            text += "catch " + cat.errorName + " from label " + cat.from + " to label " + cat.to + " with label" + cat.withLabel + "\n";
        }
    }
    addFirstBlock() {
        for (let block of this.blocks) {
            block.id += 1;
        }
        this.blocks.splice(0, 0, new Block(0, [], null));
    }
    insertBlockbBefore(blocks, id) {
        blocks.splice(id, 0, new Block(0, [], null));
        for (let i = id; i < blocks.length; i++) {
            blocks[i].id += 1;
        }
    }
    printThreeAddressStmts() {
        // format
        let indentation = ' '.repeat(4);
        let lineEnd = ';\n';
        let stmtBlocks = [];
        stmtBlocks.push(...this.blocks);
        let blockId = 0;
        if (stmtBlocks[blockId].stms[blockId].type == 'loopStatement') {
            this.insertBlockbBefore(stmtBlocks, blockId);
            blockId = 1;
        }
        blockId += 1;
        for (; blockId < stmtBlocks.length; blockId++) {
            let currStmt = stmtBlocks[blockId].stms[0];
            let lastStmt = stmtBlocks[blockId - 1].stms[0];
            if (currStmt.type == 'loopStatement' && lastStmt.type == 'loopStatement') {
                this.insertBlockbBefore(stmtBlocks, blockId);
                blockId++;
            }
        }
        let blockTailStmtStrs = new Map();
        let blockStmtStrs = new Map();
        for (let blockId = 0; blockId < stmtBlocks.length; blockId++) {
            let currBlock = stmtBlocks[blockId];
            let currStmtStrs = [];
            for (const originStmt of currBlock.stms) {
                if (originStmt.type == 'ifStatement') {
                    currStmtStrs.push(...ifStmtToString(originStmt));
                }
                else if (originStmt.type == 'loopStatement') {
                    currStmtStrs.push(...iterationStmtToString(originStmt));
                }
                else if (originStmt.type == 'switchStatement') {
                    currStmtStrs.push(...switchStmtToString(originStmt));
                }
                else if (originStmt.type == 'breakStatement' || originStmt.type == 'continueStatement') {
                    currStmtStrs.push(...jumpStmtToString(originStmt));
                }
                else {
                    for (const threeAddressStmt of originStmt.threeAddressStmts) {
                        currStmtStrs.push(threeAddressStmt.toString());
                    }
                }
            }
            blockStmtStrs.set(blockId, currStmtStrs);
        }
        // add tail stmts and print to str
        let functionBodyStr = 'method: ' + this.name + ' {\n';
        for (let blockId = 0; blockId < stmtBlocks.length; blockId++) {
            let stmtStrs = [];
            let currStmtStrs = blockStmtStrs.get(blockId);
            if (currStmtStrs != undefined) {
                stmtStrs.push(...currStmtStrs);
            }
            let tailStmtStrs = blockTailStmtStrs.get(blockId);
            if (tailStmtStrs != undefined) {
                stmtStrs.push(...tailStmtStrs);
            }
            if (blockId != 0) {
                functionBodyStr += "label" + blockId + ':\n';
            }
            functionBodyStr += indentation;
            functionBodyStr += stmtStrs.join(lineEnd + indentation);
            functionBodyStr += lineEnd;
        }
        functionBodyStr += '}\n';
        logger$8.info(functionBodyStr);
        function ifStmtToString(originStmt) {
            var _a, _b;
            let ifStmt = originStmt;
            let strs = [];
            for (const threeAddressStmt of ifStmt.threeAddressStmts) {
                if (threeAddressStmt instanceof ArkIfStmt) {
                    let nextBlockId = (_b = (_a = ifStmt.nextF) === null || _a === void 0 ? void 0 : _a.block) === null || _b === void 0 ? void 0 : _b.id;
                    strs.push(threeAddressStmt.toString() + ' goto label' + nextBlockId);
                }
                else {
                    strs.push(threeAddressStmt.toString());
                }
            }
            return strs;
        }
        function iterationStmtToString(originStmt) {
            var _a, _b, _c, _d, _e, _f;
            let iterationStmt = originStmt;
            let bodyBlockId = (_b = (_a = iterationStmt.nextT) === null || _a === void 0 ? void 0 : _a.block) === null || _b === void 0 ? void 0 : _b.id;
            if (blockTailStmtStrs.get(bodyBlockId) == undefined) {
                blockTailStmtStrs.set(bodyBlockId, []);
            }
            let currTailStmtStrs = blockTailStmtStrs.get(bodyBlockId);
            let preBlockId = bodyBlockId - 1;
            if (blockTailStmtStrs.get(preBlockId) == undefined) {
                blockTailStmtStrs.set(preBlockId, []);
            }
            let preTailStmtStrs = blockTailStmtStrs.get(preBlockId);
            let strs = [];
            let findIf = false;
            let appendAfterIf = ((_c = iterationStmt.astNode) === null || _c === void 0 ? void 0 : _c.kind) == "ForOfStatement" || ((_d = iterationStmt.astNode) === null || _d === void 0 ? void 0 : _d.kind) == "ForInStatement";
            for (const threeAddressStmt of iterationStmt.threeAddressStmts) {
                if (threeAddressStmt instanceof ArkIfStmt) {
                    let nextBlockId = (_f = (_e = iterationStmt.nextF) === null || _e === void 0 ? void 0 : _e.block) === null || _f === void 0 ? void 0 : _f.id;
                    strs.push(threeAddressStmt.toString() + ' goto label' + nextBlockId);
                    findIf = true;
                }
                else if (!findIf) {
                    preTailStmtStrs.push(threeAddressStmt.toString());
                }
                else if (threeAddressStmt instanceof ArkGotoStmt) {
                    currTailStmtStrs.push('goto label' + bodyBlockId);
                }
                else if (appendAfterIf) {
                    strs.push(threeAddressStmt.toString());
                    appendAfterIf = false;
                }
                else {
                    currTailStmtStrs.push(threeAddressStmt.toString());
                }
            }
            return strs;
        }
        // TODO:参考soot还是sootup处理switch
        function switchStmtToString(originStmt) {
            var _a, _b, _c, _d;
            let switchStmt = originStmt;
            let identifierStr = (_a = switchStmt.astNode) === null || _a === void 0 ? void 0 : _a.children[2].text;
            let str = 'lookupswitch(' + identifierStr + '){\n' + indentation;
            let strs = [];
            let nextBlockId = -1;
            for (const item of switchStmt.cases) {
                strs.push(indentation + item.value + 'goto label' + ((_b = item.stm.block) === null || _b === void 0 ? void 0 : _b.id));
                nextBlockId = (_d = (_c = item.stm.next) === null || _c === void 0 ? void 0 : _c.block) === null || _d === void 0 ? void 0 : _d.id;
            }
            strs.push(indentation + 'default: goto label' + nextBlockId);
            str += strs.join(lineEnd + indentation);
            str += lineEnd + indentation + '}';
            return [str];
        }
        function jumpStmtToString(originStmt) {
            var _a, _b;
            let targetId = (_b = (_a = originStmt.next) === null || _a === void 0 ? void 0 : _a.block) === null || _b === void 0 ? void 0 : _b.id;
            return ["goto label" + targetId];
        }
    }
    printThreeAddressStrs() {
        logger$8.info('#### printThreeAddressStrs ####');
        for (const stmt of this.statementArray) {
            logger$8.info('------ origin stmt: ', stmt.code);
            for (const threeAddressstr of stmt.addressCode3) {
                logger$8.info(threeAddressstr);
            }
        }
    }
    printThreeAddressStrsAndStmts() {
        for (const stmt of this.statementArray) {
            if (stmt.astNode && stmt.code) {
                logger$8.info('----- origin stmt: ', stmt.code);
                logger$8.info('-- threeAddressStrs:');
                for (const threeAddressstr of stmt.addressCode3) {
                    logger$8.info(threeAddressstr);
                }
                logger$8.info('-- threeAddressStmts:');
                for (const threeAddressStmt of stmt.threeAddressStmts) {
                    logger$8.info(threeAddressStmt);
                }
            }
        }
    }
    printOriginStmts() {
        logger$8.info('#### printOriginStmts ####');
        for (const stmt of this.statementArray) {
            logger$8.info(stmt);
        }
    }
    // TODO: Add more APIs to the class 'Cfg', and use these to build Cfg
    buildOriginalCfg() {
        let originalCfg = new Cfg();
        let blockBuilderToBlock = new Map();
        for (const blockBuilder of this.blocks) {
            let block = new BasicBlock();
            for (const stmtBuilder of blockBuilder.stms) {
                if (stmtBuilder.astNode == null) {
                    continue;
                }
                let originlStmt = new Stmt();
                originlStmt.setText(stmtBuilder.code);
                originlStmt.setPositionInfo(stmtBuilder.line);
                originlStmt.setOriginPositionInfo(stmtBuilder.line);
                originlStmt.setColumn(stmtBuilder.column);
                originlStmt.setOriginColumn(stmtBuilder.column);
                block.addStmt(originlStmt);
            }
            originalCfg.addBlock(block);
            // build the map
            blockBuilderToBlock.set(blockBuilder, block);
        }
        // link block
        for (const [blockBuilder, block] of blockBuilderToBlock) {
            for (const successorBuilder of blockBuilder.nexts) {
                let successorBlock = blockBuilderToBlock.get(successorBuilder);
                successorBlock.addPredecessorBlock(block);
                block.addSuccessorBlock(successorBlock);
            }
        }
        return originalCfg;
    }
    // TODO: Add more APIs to class 'Cfg', and use these to build Cfg
    buildCfg() {
        let cfg = new Cfg();
        cfg.declaringClass = this.declaringClass;
        let blockBuilderToBlock = new Map();
        let stmtPos = -1;
        for (const blockBuilder of this.blocks) {
            let block = new BasicBlock();
            for (const stmtBuilder of blockBuilder.stms) {
                for (const threeAddressStmt of stmtBuilder.threeAddressStmts) {
                    if (stmtPos == -1) {
                        stmtPos = stmtBuilder.line;
                        cfg.setStartingStmt(threeAddressStmt);
                    }
                    threeAddressStmt.setOriginPositionInfo(stmtBuilder.line);
                    threeAddressStmt.setPositionInfo(stmtPos);
                    stmtPos++;
                    block.addStmt(threeAddressStmt);
                    threeAddressStmt.setCfg(cfg);
                }
            }
            cfg.addBlock(block);
            // build the map
            blockBuilderToBlock.set(blockBuilder, block);
        }
        // link block
        for (const [blockBuilder, block] of blockBuilderToBlock) {
            for (const successorBuilder of blockBuilder.nexts) {
                let successorBlock = blockBuilderToBlock.get(successorBuilder);
                successorBlock.addPredecessorBlock(block);
                block.addSuccessorBlock(successorBlock);
            }
        }
        return cfg;
    }
    getLocals() {
        return this.locals;
    }
    getTypeNode(node) {
        for (let child of node.children) {
            let result = this.resolveTypeNode(child);
            if (result !== UnknownType.getInstance()) {
                return result;
            }
        }
        return UnknownType.getInstance();
    }
    resolveTypeNode(node) {
        let typeNode;
        switch (node.kind) {
            case "BooleanKeyword":
            case "NumberKeyword":
            case "StringKeyword":
            case "VoidKeyword":
            case "AnyKeyword":
                return TypeInference.buildTypeFromStr(this.resolveKeywordType(node));
            case "ArrayType":
                typeNode = node.children[0];
                const typeStr = typeNode.text;
                return new ArrayType(TypeInference.buildTypeFromStr(typeStr), 1);
            case "TypeReference":
                return new AnnotationNamespaceType(node.text);
            case "UnionType":
                const types = [];
                typeNode = node.children[0];
                for (const singleTypeNode of typeNode.children) {
                    if (singleTypeNode.kind != "BarToken") {
                        const singleType = this.resolveTypeNode(singleTypeNode);
                        types.push(singleType);
                    }
                }
                return new UnionType(types);
            case 'TupleType':
                const tupleTypes = [];
                typeNode = node.children[1];
                for (const singleTypeNode of typeNode.children) {
                    if (singleTypeNode.kind != "CommaToken") {
                        const singleType = this.resolveTypeNode(singleTypeNode);
                        tupleTypes.push(singleType);
                    }
                }
                return new TupleType(tupleTypes);
            case 'TypeQuery':
                return new AnnotationTypeQueryType(node.children[1].text);
        }
        return UnknownType.getInstance();
    }
    resolveKeywordType(node) {
        switch (node.kind) {
            case 'TrueKeyword':
            case 'FalseKeyword':
            case "BooleanKeyword":
            case "FalseKeyword":
            case "TrueKeyword":
                return "boolean";
            case "NumberKeyword":
            case "FirstLiteralToken":
                return "number";
            case "StringKeyword":
            case "StringLiteral":
                return "string";
            case "VoidKeyword":
                return "void";
            case "AnyKeyword":
                return "any";
            case 'NullKeyword':
                return 'null';
            case 'RegularExpressionLiteral':
                return 'RegularExpression';
            default:
                return "";
        }
    }
    buildCfgBuilder() {
        this.walkAST(this.entry, this.exit, this.astRoot);
        this.addReturnInEmptyMethod();
        this.deleteExit(this.entry);
        this.CfgBuilder2Array(this.entry);
        this.resetWalked();
        this.buildLastAndHaveCall(this.entry);
        this.resetWalked();
        this.buildBlocks(this.entry, this.entryBlock);
        this.blocks = this.blocks.filter((b) => b.stms.length != 0);
        this.buildBlocksNextLast();
        this.addReturnBlock();
        this.resetWalked();
        // this.generateUseDef();
        // this.resetWalked();
        // this.printBlocks();
        this.transformToThreeAddress();
    }
}

class BodyBuilder {
    constructor(methodSignature, sourceAstNode, declaringMethod) {
        this.methodSignature = methodSignature;
        this.cfgBuilder = new CfgBuilder(sourceAstNode, this.methodSignature.getMethodSubSignature().getMethodName(), declaringMethod);
    }
    build() {
        let cfg = this.cfgBuilder.buildCfg();
        cfg.buildDefUseStmt();
        let originalCfg = this.cfgBuilder.buildOriginalCfg();
        let locals = new Set(this.cfgBuilder.getLocals());
        return new ArkBody(this.methodSignature, locals, originalCfg, cfg);
    }
}

const BUILDIN_CONTAINER_COMPONENT = new Set([
    'Badge', 'Button', 'Calendar', 'Canvas', 'Checkbox', 'CheckboxGroup', 'ColorPicker', 'ColorPickerDialog',
    'Column', 'ColumnSplit', 'ContainerSpan', 'Counter', 'DataPanel', 'DatePicker', 'EffectComponent', 'Flex',
    'FlowItem', 'FolderStack', 'FormLink', 'Gauge', 'Grid', 'GridItem', 'GridCol', 'GridContainer', 'GridRow',
    'Hyperlink', 'List', 'ListItem', 'ListItemGroup', 'Menu', 'MenuItem', 'MenuItemGroup', 'Navigation',
    'Navigator', 'NavDestination', 'NavRouter', 'Option', 'Panel', 'Piece', 'PluginComponent', 'QRCode',
    'Rating', 'Refresh', 'RelativeContainer', 'RootScene', 'Row', 'RowSplit', 'Screen', 'Scroll', 'ScrollBar',
    'Section', 'Select', 'Shape', 'Sheet', 'SideBarContainer', 'Stack', 'Stepper', 'StepperItem', 'Swiper',
    'Tabs', 'TabContent', 'Text', 'TextPicker', 'TextTimer', 'TextClock', 'TimePicker', 'Toggle', 'WaterFlow',
    'WindowScene', 'XComponent',
    'ForEach', 'LazyForEach', 'If', 'IfBranch'
]);
const COMPONENT_CREATE_FUNCTION = new Set(['create', 'createWithChild', 'createWithLabel', 'branchId']);
class ViewTreeNode {
    constructor(name, stmt, expr, tree) {
        this.name = name;
        this.stmts = new Map();
        this.parent = null;
        this.children = [];
        this.tree = tree;
        this.addStmt(stmt, expr);
    }
    addStmt(stmt, expr) {
        let key = expr.getMethodSignature().getMethodSubSignature().getMethodName();
        let relationValues = [];
        for (const arg of expr.getArgs()) {
            if (arg instanceof Local) {
                this.getBindValues(arg, relationValues);
            }
        }
        this.stmts.set(key, [stmt, relationValues]);
    }
    getBindValues(local, relationValues) {
        const stmt = local.getDeclaringStmt();
        if (!stmt) {
            let type = local.getType();
            if (type instanceof CallableType) {
                relationValues.push(type.getMethodSignature());
            }
            return;
        }
        for (const v of stmt.getUses()) {
            if (v instanceof Constant) {
                relationValues.push(v);
            }
            else if (v instanceof ArkInstanceFieldRef) {
                if (this.tree.isClassField(v.getFieldName())) {
                    relationValues.push(v);
                }
            }
            else if (v instanceof Local) {
                this.getBindValues(v, relationValues);
            }
        }
    }
}
class TreeNodeStack {
    constructor() {
        this.stack = [];
    }
    push(node) {
        let parent = this.getParent();
        node.parent = parent;
        this.stack.push(node);
        if (parent == null) {
            this.root = node;
        }
        else {
            parent.children.push(node);
        }
    }
    pop() {
        this.stack.pop();
    }
    top() {
        return this.isEmpty() ? null : this.stack[this.stack.length - 1];
    }
    isEmpty() {
        return this.stack.length == 0;
    }
    popAutomicComponent(name) {
        if (this.isEmpty()) {
            return;
        }
        let node = this.stack[this.stack.length - 1];
        if (name != node.name && !this.isContainer(node.name)) {
            this.stack.pop();
        }
    }
    popComponentExpect(name) {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].name != name) {
                this.stack.pop();
            }
            else {
                break;
            }
        }
        return this;
    }
    getParent() {
        if (this.stack.length == 0) {
            return null;
        }
        let node = this.stack[this.stack.length - 1];
        if (!this.isContainer(node.name)) {
            this.stack.pop();
        }
        return this.stack[this.stack.length - 1];
    }
    isContainer(name) {
        return BUILDIN_CONTAINER_COMPONENT.has(name);
    }
}
class ViewTree {
    constructor(render) {
        this.render = render;
        this.fieldTypes = new Map();
    }
    buildViewTree() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.render || this.isInitialized()) {
                return;
            }
            yield this.loadClasssFieldTypes();
            let treeStack = new TreeNodeStack();
            yield this.parseCfg(this.render.getCfg(), treeStack);
            this.root = treeStack.root;
        });
    }
    isInitialized() {
        return this.root != null;
    }
    getRoot() {
        return this.root;
    }
    parseForEachAnonymousFunc(treeStack, expr) {
        return __awaiter(this, void 0, void 0, function* () {
            let arg = expr.getArg(3);
            let type = arg.getType();
            let method = this.render.getDeclaringArkClass().getMethod(type.getMethodSignature());
            if (method) {
                yield this.parseCfg(method.getCfg(), treeStack);
            }
        });
    }
    parseComponentView(view, expr) {
        return __awaiter(this, void 0, void 0, function* () {
            let arg = expr.getArg(0);
            let assignStmt = arg.getDeclaringStmt();
            let classSignature;
            let rightOp = assignStmt.getRightOp();
            if (rightOp instanceof ArkNewExpr) {
                classSignature = rightOp.getType().getClassSignature();
                view.classSignature = classSignature;
            }
            else {
                return false;
            }
            let componentCls = this.render.getDeclaringArkFile().getScene().getClass(classSignature);
            let componentViewTree = yield (componentCls === null || componentCls === void 0 ? void 0 : componentCls.getViewTree());
            if (componentViewTree) {
                view.children.push(componentViewTree.getRoot());
            }
            return true;
        });
    }
    parseCfg(cfg, treeStack) {
        return __awaiter(this, void 0, void 0, function* () {
            let blocks = cfg.getBlocks();
            for (const block of blocks) {
                for (const stmt of block.getStmts()) {
                    if (!(stmt instanceof ArkInvokeStmt)) {
                        continue;
                    }
                    let expr = stmt.getInvokeExpr();
                    if (!(expr instanceof ArkInstanceInvokeExpr)) {
                        continue;
                    }
                    let name = expr.getBase().getName();
                    if (name.startsWith('$temp')) {
                        continue;
                    }
                    let methodName = expr.getMethodSignature().getMethodSubSignature().getMethodName();
                    if (name == 'this' && this.getClassFieldType('__' + methodName) == '@BuilderParam') {
                        let node = new ViewTreeNode(`@BuilderParam`, stmt, expr, this);
                        node.buildParam = methodName;
                        treeStack.push(node);
                        continue;
                    }
                    treeStack.popAutomicComponent(name);
                    let currentNode = treeStack.top();
                    if (name == 'If' && methodName == 'branchId') {
                        name = 'IfBranch';
                        treeStack.popComponentExpect('If');
                    }
                    if (this.isCreateFunc(methodName)) {
                        let node = new ViewTreeNode(name, stmt, expr, this);
                        if (name == 'View' && !(yield this.parseComponentView(node, expr))) {
                            continue;
                        }
                        treeStack.push(node);
                        if (name == 'ForEach' || name == 'LazyForEach') {
                            yield this.parseForEachAnonymousFunc(treeStack, expr);
                        }
                        continue;
                    }
                    if (name == (currentNode === null || currentNode === void 0 ? void 0 : currentNode.name)) {
                        currentNode.addStmt(stmt, expr);
                        if (methodName == 'pop') {
                            treeStack.pop();
                        }
                    }
                    else if (name == 'If' && methodName == 'pop') {
                        treeStack.popComponentExpect('If');
                        treeStack.pop();
                    }
                }
            }
        });
    }
    isCreateFunc(name) {
        return COMPONENT_CREATE_FUNCTION.has(name);
    }
    loadClasssFieldTypes() {
        return __awaiter(this, void 0, void 0, function* () {
            let arkFile = this.render.getDeclaringArkFile();
            for (const field of this.render.getDeclaringArkClass().getFields()) {
                let position = yield arkFile.getEtsOriginalPositionFor(field.getOriginPosition());
                let content = yield arkFile.getEtsSource(position.getLineNo());
                let regex;
                if (field.getName().startsWith('__')) {
                    regex = new RegExp('@[\\w]*[\\s]*' + field.getName().slice(2), 'gi');
                }
                else {
                    regex = new RegExp('@[\\w]*[\\s]*' + field.getName(), 'gi');
                }
                let match = content.match(regex);
                if (match) {
                    this.fieldTypes.set(field.getName(), match[0].split(/[\s]/)[0]);
                    continue;
                }
                this.fieldTypes.set(field.getName(), field.getSignature().getType());
            }
            for (const method of this.render.getDeclaringArkClass().getMethods()) {
                let name = method.getName();
                if (name.startsWith('Set-')) {
                    name = name.replace('Set-', '');
                    if (this.fieldTypes.has('__' + name)) {
                        this.fieldTypes.set(name, this.fieldTypes.get('__' + name));
                    }
                }
            }
        });
    }
    isClassField(name) {
        return this.fieldTypes.has(name);
    }
    getClassFieldType(name) {
        return this.fieldTypes.get(name);
    }
}

const arkMethodNodeKind = ['MethodDeclaration', 'Constructor', 'FunctionDeclaration', 'GetAccessor',
    'SetAccessor', 'ArrowFunction', 'FunctionExpression', 'MethodSignature', 'ConstructSignature', 'CallSignature'];
class ArkMethod {
    constructor() {
        this.line = -1;
        this.column = -1;
        this.returnType = UnknownType.getInstance();
        this.parameters = [];
        this.modifiers = new Set();
        this.typeParameters = [];
    }
    getName() {
        return this.name;
    }
    setName(name) {
        this.name = name;
    }
    getCode() {
        return this.code;
    }
    setCode(code) {
        this.code = code;
    }
    getLine() {
        return this.line;
    }
    setLine(line) {
        this.line = line;
    }
    getColumn() {
        return this.column;
    }
    setColumn(column) {
        this.column = column;
    }
    setEtsPositionInfo(position) {
        this.etsPosition = position;
    }
    getEtsPositionInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.etsPosition) {
                let arkFile = this.declaringArkFile;
                const etsPosition = yield arkFile.getEtsOriginalPositionFor(new LineColPosition(this.line, this.column));
                this.setEtsPositionInfo(etsPosition);
            }
            return this.etsPosition;
        });
    }
    getDeclaringArkClass() {
        return this.declaringArkClass;
    }
    setDeclaringArkClass(declaringArkClass) {
        this.declaringArkClass = declaringArkClass;
    }
    getDeclaringArkFile() {
        return this.declaringArkFile;
    }
    setDeclaringArkFile() {
        this.declaringArkFile = this.getDeclaringArkClass().getDeclaringArkFile();
    }
    isExported() {
        return this.modifiers.has('ExportKeyword');
    }
    isDefaultArkMethod() {
        return this.getName() === "_DEFAULT_ARK_METHOD";
    }
    getParameters() {
        return this.parameters;
    }
    addParameter(methodParameter) {
        this.parameters.push(methodParameter);
    }
    getReturnType() {
        return this.returnType;
    }
    setReturnType(type) {
        this.returnType = type;
        if (this.methodSubSignature) {
            this.methodSubSignature.setReturnType(type);
        }
    }
    getSignature() {
        return this.methodSignature;
    }
    setSignature(methodSignature) {
        this.methodSignature = methodSignature;
    }
    getSubSignature() {
        return this.methodSubSignature;
    }
    setSubSignature(methodSubSignature) {
        this.methodSubSignature = methodSubSignature;
    }
    genSignature() {
        let mtdSubSig = new MethodSubSignature();
        mtdSubSig.setMethodName(this.name);
        mtdSubSig.setParameters(this.parameters);
        mtdSubSig.setReturnType(this.returnType);
        this.setSubSignature(mtdSubSig);
        let mtdSig = new MethodSignature();
        mtdSig.setDeclaringClassSignature(this.declaringArkClass.getSignature());
        mtdSig.setMethodSubSignature(mtdSubSig);
        this.setSignature(mtdSig);
    }
    getModifiers() {
        return this.modifiers;
    }
    addModifier(name) {
        this.modifiers.add(name);
    }
    getTypeParameter() {
        return this.typeParameters;
    }
    addTypeParameter(typeParameter) {
        this.typeParameters.push(typeParameter);
    }
    containsModifier(name) {
        return this.modifiers.has(name);
    }
    getBody() {
        return this.body;
    }
    setBody(body) {
        this.body = body;
    }
    getCfg() {
        return this.body.getCfg();
    }
    getOriginalCfg() {
        return this.body.getOriginalCfg();
    }
    getParameterInstances() {
        // 获取方法体中参数Local实例
        let stmts = this.getCfg().getStmts();
        let results = [];
        for (let stmt of stmts) {
            if (stmt instanceof ArkAssignStmt) {
                if (stmt.getRightOp() instanceof ArkParameterRef) {
                    results.push(stmt.getLeftOp());
                }
            }
            if (results.length == this.getParameters().length) {
                return results;
            }
        }
        return results;
    }
    getThisInstance() {
        // 获取方法体中This实例
        let stmts = this.getCfg().getStmts();
        for (let stmt of stmts) {
            if (stmt instanceof ArkAssignStmt) {
                if (stmt.getRightOp() instanceof ArkThisRef) {
                    return stmt.getLeftOp();
                }
            }
        }
        return null;
    }
    getReturnValues() {
        // 获取方法体中return值实例
        let resultValues = [];
        let stmts = this.getCfg().getStmts();
        for (let stmt of stmts) {
            if (stmt instanceof ArkReturnStmt) {
                resultValues.push(stmt.getOp());
            }
        }
        return resultValues;
    }
}
function buildArkMethodFromArkClass(methodNode, declaringClass, mtd) {
    mtd.setDeclaringArkClass(declaringClass);
    mtd.setDeclaringArkFile();
    if (arkMethodNodeKind.indexOf(methodNode.kind) > -1) {
        buildNormalArkMethodFromAstNode(methodNode, mtd);
    }
    else {
        mtd.setName("_DEFAULT_ARK_METHOD");
    }
    mtd.genSignature();
    if (methodNode.kind != "SyntaxList") {
        methodNode = methodNode.children[methodNode.children.length - 1].children[1];
    }
    let bodyBuilder = new BodyBuilder(mtd.getSignature(), methodNode, mtd);
    mtd.setBody(bodyBuilder.build());
    mtd.getCfg().setDeclaringMethod(mtd);
    if (mtd.getName() == 'constructor' && mtd.getDeclaringArkClass()) {
        mtd.getCfg().constructorAddInit(mtd);
    }
    if (mtd.getName() == 'render' && declaringClass.getSuperClassName() == 'View') {
        declaringClass.setViewTree(new ViewTree(mtd));
    }
}
function buildNormalArkMethodFromAstNode(methodNode, mtd) {
    mtd.setCode(methodNode.text);
    mtd.setLine(methodNode.line + 1);
    mtd.setColumn(methodNode.character + 1);
    if (!methodNode.methodNodeInfo) {
        throw new Error('Error: There is no methodNodeInfo for this method!');
    }
    mtd.setName(methodNode.methodNodeInfo.name);
    methodNode.methodNodeInfo.modifiers.forEach((modifier) => {
        mtd.addModifier(modifier);
    });
    methodNode.methodNodeInfo.parameters.forEach(methodParameter => {
        mtd.addParameter(methodParameter);
    });
    mtd.setReturnType(methodNode.methodNodeInfo.returnType);
    methodNode.methodNodeInfo.typeParameters.forEach((typeParameter) => {
        mtd.addTypeParameter(typeParameter);
    });
}
function buildNormalArkMethodFromMethodInfo(methodInfo, mtd) {
    mtd.setName(methodInfo.name);
    methodInfo.modifiers.forEach((modifier) => {
        mtd.addModifier(modifier);
    });
    methodInfo.parameters.forEach(methodParameter => {
        mtd.addParameter(methodParameter);
    });
    mtd.setReturnType(methodInfo.returnType);
    methodInfo.typeParameters.forEach((typeParameter) => {
        mtd.addTypeParameter(typeParameter);
    });
}

const logger$7 = ConsoleLogger.getLogger();
class ArkClass {
    constructor() {
        this.originType = "Class";
        this.line = -1;
        this.column = -1;
        /* // Deprecated
        private declaringSignature: string;
        private arkInstancesMap: Map<string, any> = new Map<string, any>();
        private arkSignature: string; */
        this.superClassName = '';
        this.extendedClasses = [];
        this.implementedInterfaceNames = [];
        this.modifiers = new Set();
        this.typeParameters = [];
        this.defaultMethod = null;
        this.methods = [];
        this.fields = [];
    }
    /* // Deprecated
    public addArkInstance(arkSignature: string, arkInstance: any) {
        this.arkInstancesMap.set(arkSignature, arkInstance);
    }

    public getArkInstancesMap() {
        return this.arkInstancesMap;
    } */
    getName() {
        return this.name;
    }
    setName(name) {
        this.name = name;
    }
    getCode() {
        return this.code;
    }
    setCode(code) {
        this.code = code;
    }
    getLine() {
        return this.line;
    }
    setLine(line) {
        this.line = line;
    }
    getColumn() {
        return this.column;
    }
    setColumn(column) {
        this.column = column;
    }
    setEtsPositionInfo(position) {
        this.etsPosition = position;
    }
    getEtsPositionInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.etsPosition) {
                let arkFile = this.declaringArkFile;
                const etsPosition = yield arkFile.getEtsOriginalPositionFor(new LineColPosition(this.line, this.column));
                this.setEtsPositionInfo(etsPosition);
            }
            return this.etsPosition;
        });
    }
    getOriginType() {
        return this.originType;
    }
    setOriginType(originType) {
        this.originType = originType;
    }
    getDeclaringArkFile() {
        return this.declaringArkFile;
    }
    setDeclaringArkFile(declaringArkFile) {
        this.declaringArkFile = declaringArkFile;
    }
    getDeclaringArkNamespace() {
        return this.declaringArkNamespace;
    }
    setDeclaringArkNamespace(declaringArkNamespace) {
        this.declaringArkNamespace = declaringArkNamespace;
    }
    isExported() {
        return this.modifiers.has('ExportKeyword');
    }
    isDefaultArkClass() {
        return this.getName() === "_DEFAULT_ARK_CLASS";
    }
    getSignature() {
        return this.classSignature;
    }
    setSignature(classSig) {
        this.classSignature = classSig;
    }
    genSignature() {
        let classSig = new ClassSignature();
        classSig.setClassName(this.name);
        classSig.setDeclaringFileSignature(this.declaringArkFile.getFileSignature());
        if (this.declaringArkNamespace) {
            classSig.setDeclaringNamespaceSignature(this.declaringArkNamespace.getNamespaceSignature());
        }
        this.setSignature(classSig);
    }
    getSuperClassName() {
        return this.superClassName;
    }
    setSuperClassName(superClassName) {
        this.superClassName = superClassName;
    }
    getSuperClass() {
        return this.superClass;
    }
    setSuperClass(superClass) {
        this.superClass = superClass;
    }
    getExtendedClasses() {
        return this.extendedClasses;
    }
    addExtendedClass(extendedClass) {
        this.extendedClasses.push(extendedClass);
    }
    getImplementedInterfaceNames() {
        return this.implementedInterfaceNames;
    }
    addImplementedInterfaceName(interfaceName) {
        this.implementedInterfaceNames.push(interfaceName);
    }
    hasImplementedInterface(interfaceName) {
        return (this.implementedInterfaceNames.indexOf(interfaceName) > -1);
    }
    getField(fieldSignature) {
        let returnVal = null;
        this.getFields().forEach((field) => {
            if (field.getSignature().toString() == fieldSignature.toString()) {
                returnVal = field;
            }
        });
        return returnVal;
    }
    getFields() {
        return this.fields;
    }
    addField(field) {
        this.fields.push(field);
    }
    addFields(fields) {
        fields.forEach((field) => {
            this.addField(field);
        });
    }
    getModifiers() {
        return this.modifiers;
    }
    addModifier(name) {
        this.modifiers.add(name);
    }
    getTypeParameter() {
        return this.typeParameters;
    }
    addTypeParameter(typeParameter) {
        this.typeParameters.push(typeParameter);
    }
    containsModifier(name) {
        return this.modifiers.has(name);
    }
    getMethods() {
        return this.methods;
    }
    getMethod(methodSignature) {
        let returnVal = null;
        this.methods.forEach((mtd) => {
            if (mtd.getSignature().toString() == methodSignature.toString()) {
                returnVal = mtd;
            }
        });
        return returnVal;
    }
    addMethod(method) {
        this.methods.push(method);
    }
    setDefaultArkMethod(defaultMethod) {
        this.defaultMethod = defaultMethod;
        this.addMethod(defaultMethod);
    }
    getDefaultArkMethod() {
        return this.defaultMethod;
    }
    setViewTree(viewTree) {
        this.viewTree = viewTree;
    }
    getViewTree() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.hasViewTree() && !this.viewTree.isInitialized()) {
                yield this.viewTree.buildViewTree();
            }
            return this.viewTree;
        });
    }
    hasViewTree() {
        return this.viewTree != undefined;
    }
    getStaticFields(classMap) {
        const fields = [];
        let classes = [];
        if (this.declaringArkNamespace) {
            classes = classMap.get(this.declaringArkNamespace.getNamespaceSignature());
        }
        else {
            classes = classMap.get(this.declaringArkFile.getFileSignature());
        }
        for (const arkClass of classes) {
            for (const field of arkClass.getFields()) {
                if (field.isStatic()) {
                    fields.push(field);
                }
            }
        }
        return fields;
    }
}
function buildDefaultArkClassFromArkFile(defaultlassNode, arkFile, defaultClass) {
    defaultClass.setDeclaringArkFile(arkFile);
    buildDefaultArkClass(defaultlassNode, defaultClass);
}
function buildDefaultArkClassFromArkNamespace(defaultClassNode, arkNamespace, defaultClass) {
    defaultClass.setDeclaringArkNamespace(arkNamespace);
    defaultClass.setDeclaringArkFile(arkNamespace.getDeclaringArkFile());
    buildDefaultArkClass(defaultClassNode, defaultClass);
}
function buildNormalArkClassFromArkFile(clsNode, arkFile, cls) {
    cls.setDeclaringArkFile(arkFile);
    cls.setCode(clsNode.text);
    cls.setLine(clsNode.line + 1);
    cls.setColumn(clsNode.character + 1);
    buildNormalArkClass(clsNode, cls);
}
function buildNormalArkClassFromArkNamespace(clsNode, arkNamespace, cls) {
    cls.setDeclaringArkNamespace(arkNamespace);
    cls.setDeclaringArkFile(arkNamespace.getDeclaringArkFile());
    cls.setCode(clsNode.text);
    cls.setLine(clsNode.line + 1);
    cls.setColumn(clsNode.character + 1);
    buildNormalArkClass(clsNode, cls);
}
function buildDefaultArkClass(defaultClassNode, cls) {
    cls.setName("_DEFAULT_ARK_CLASS");
    cls.genSignature();
    genDefaultArkMethod(defaultClassNode, cls);
}
function buildNormalArkClass(clsNode, cls) {
    var _a;
    if (!clsNode.classNodeInfo) {
        throw new Error('Error: There is no classNodeInfo for this ClassDeclaration!');
    }
    cls.setName(clsNode.classNodeInfo.getClassName());
    cls.setOriginType(clsNode.classNodeInfo.getOriginType());
    cls.genSignature();
    clsNode.classNodeInfo.getmodifiers().forEach((modifier) => {
        cls.addModifier(modifier);
    });
    for (let [key, value] of clsNode.classNodeInfo.getHeritageClauses()) {
        if (value == 'ExtendsKeyword') {
            cls.setSuperClassName(key);
        }
        else {
            cls.addImplementedInterfaceName(key);
        }
    }
    cls.addFields(clsNode.classNodeInfo.getMembers());
    cls.getFields().forEach((field) => {
        field.setDeclaringClass(cls);
        field.genSignature();
        let initializer = field.getInitializer();
        if (initializer instanceof ObjectLiteralExpr) {
            let anonymousClass = initializer.getAnonymousClass();
            let newName = 'AnonymousClass-' + cls.getName() + '-' + field.getName();
            anonymousClass.setName(newName);
            anonymousClass.setDeclaringArkNamespace(cls.getDeclaringArkNamespace());
            anonymousClass.setDeclaringArkFile(cls.getDeclaringArkFile());
            anonymousClass.genSignature();
            anonymousClass.getMethods().forEach((mtd) => {
                mtd.setDeclaringArkClass(anonymousClass);
                mtd.setDeclaringArkFile();
                mtd.genSignature();
            });
        }
    });
    clsNode.classNodeInfo.getTypeParameters().forEach((typeParameter) => {
        cls.addTypeParameter(typeParameter);
    });
    // generate ArkMethods of this class
    for (let child of clsNode.children) {
        if (child.kind == 'SyntaxList') {
            for (let cld of child.children) {
                if (arkMethodNodeKind.indexOf(cld.kind) > -1) {
                    let mthd = new ArkMethod();
                    buildArkMethodFromArkClass(cld, cls, mthd);
                    cls.addMethod(mthd);
                    if (cld.kind == 'GetAccessor') {
                        let getAccessorName = (_a = cld.methodNodeInfo) === null || _a === void 0 ? void 0 : _a.getAccessorName;
                        if (!getAccessorName) {
                            logger$7.warn("Cannot get GetAccessorName for method: ", mthd.getSignature().toString());
                        }
                        else {
                            cls.getFields().forEach((field) => {
                                if (field.getName() === getAccessorName) {
                                    field.setParameters(mthd.getParameters());
                                    field.setType(mthd.getReturnType());
                                    field.setTypeParameters(mthd.getTypeParameter());
                                    field.setArkMethodSignature(mthd.getSignature());
                                }
                            });
                        }
                    }
                }
            }
        }
    }
}
function genDefaultArkMethod(defaultMethodNode, cls) {
    let defaultMethod = new ArkMethod();
    buildArkMethodFromArkClass(defaultMethodNode, cls, defaultMethod);
    cls.setDefaultArkMethod(defaultMethod);
}

const logger$6 = ConsoleLogger.getLogger();
class TypeInference {
    constructor(scene) {
        this.scene = scene;
    }
    inferTypeInMethod(arkMethod) {
        const body = arkMethod.getBody();
        if (!body) {
            logger$6.warn('empty body');
            return;
        }
        const cfg = body.getCfg();
        for (const block of cfg.getBlocks()) {
            for (const stmt of block.getStmts()) {
                this.resolveSymbolInStmt(stmt, arkMethod);
                TypeInference.inferTypeInStmt(stmt, arkMethod);
            }
        }
    }
    inferSimpleTypeInMethod(arkMethod) {
        const body = arkMethod.getBody();
        if (!body) {
            logger$6.warn('empty body');
            return;
        }
        const cfg = body.getCfg();
        for (const block of cfg.getBlocks()) {
            for (const stmt of block.getStmts()) {
                TypeInference.inferSimpleTypeInStmt(stmt);
            }
        }
    }
    /** resolve symbol that is uncertain when build stmts, such as class' name and function's name */
    resolveSymbolInStmt(stmt, arkMethod) {
        const exprs = stmt.getExprs();
        for (const expr of exprs) {
            if (expr instanceof ArkNewExpr) {
                let classType = expr.getType();
                const className = classType.getClassSignature().getClassName();
                const arkClass = ModelUtils.getClassWithName(className, arkMethod);
                if (arkClass) {
                    classType.setClassSignature(arkClass.getSignature());
                }
            }
            else if (expr instanceof ArkInstanceInvokeExpr) {
                const base = expr.getBase();
                let type = base.getType();
                if (type instanceof UnknownType) {
                    const arkClass = ModelUtils.getClassWithName(base.getName(), arkMethod);
                    if (arkClass) {
                        type = new ClassType(arkClass.getSignature());
                        base.setType(type);
                    }
                    else {
                        const arkNamespace = ModelUtils.getNamespaceWithName(base.getName(), arkMethod);
                        if (arkNamespace) {
                            const methodName = expr.getMethodSignature().getMethodSubSignature().getMethodName();
                            const defaultClass = arkNamespace.getClasses().find(cls => cls.getName() == '_DEFAULT_ARK_CLASS') || null;
                            const foundMethod = ModelUtils.getMethodInClassWithName(methodName, defaultClass);
                            if (foundMethod) {
                                let replaceStaticInvokeExpr = new ArkStaticInvokeExpr(foundMethod.getSignature(), expr.getArgs());
                                if (stmt.containsInvokeExpr()) {
                                    if (stmt instanceof ArkAssignStmt && stmt.getRightOp() instanceof ArkInstanceInvokeExpr) {
                                        stmt.setRightOp(replaceStaticInvokeExpr);
                                    }
                                    else if (stmt instanceof ArkInvokeStmt) {
                                        stmt.replaceInvokeExpr(replaceStaticInvokeExpr);
                                    }
                                    stmt.setText(stmt.toString().replace(/^instanceInvoke/, "staticinvoke"));
                                }
                                this.inferMethodReturnType(foundMethod);
                                if (stmt instanceof ArkAssignStmt) {
                                    const leftOp = stmt.getLeftOp();
                                    if (leftOp instanceof Local) {
                                        leftOp.setType(foundMethod.getReturnType);
                                    }
                                }
                                return;
                            }
                        }
                    }
                }
                if (!(type instanceof ClassType)) {
                    logger$6.warn(`type of base must be ClassType expr: ${expr.toString()}`);
                    continue;
                }
                const arkClass = ModelUtils.getClassWithClassSignature(type.getClassSignature(), this.scene);
                if (arkClass == null) {
                    logger$6.warn(`class ${type.getClassSignature().getClassName()} does not exist`);
                    continue;
                }
                const methodSignature = expr.getMethodSignature();
                const methodName = methodSignature.getMethodSubSignature().getMethodName();
                const method = ModelUtils.getMethodInClassWithName(methodName, arkClass);
                if (method == null) {
                    logger$6.warn(`method ${methodName} does not exist`);
                    continue;
                }
                // infer return type
                this.inferMethodReturnType(method);
                if (stmt instanceof ArkAssignStmt) {
                    const leftOp = stmt.getLeftOp();
                    if (leftOp instanceof Local) {
                        leftOp.setType(method.getReturnType());
                    }
                }
                expr.setMethodSignature(method.getSignature());
                if (method.getModifiers().has("StaticKeyword")) {
                    let replaceStaticInvokeExpr = new ArkStaticInvokeExpr(method.getSignature(), expr.getArgs());
                    if (stmt.containsInvokeExpr()) {
                        stmt.replaceInvokeExpr(replaceStaticInvokeExpr);
                        if (stmt instanceof ArkAssignStmt && stmt.getRightOp() instanceof ArkInstanceInvokeExpr) {
                            stmt.setRightOp(replaceStaticInvokeExpr);
                        }
                        else if (stmt instanceof ArkInvokeStmt) {
                            stmt.replaceInvokeExpr(replaceStaticInvokeExpr);
                        }
                    }
                }
            }
            else if (expr instanceof ArkStaticInvokeExpr) {
                const methodSignature = expr.getMethodSignature();
                const methodName = methodSignature.getMethodSubSignature().getMethodName();
                const method = ModelUtils.getStaticMethodWithName(methodName, arkMethod);
                if (method == null) {
                    logger$6.warn(`method ${methodName} does not exist`);
                    continue;
                }
                expr.setMethodSignature(method.getSignature());
            }
        }
        for (const use of stmt.getUses()) {
            if (use instanceof ArkInstanceFieldRef) {
                let fieldType = this.handleClassField(use, arkMethod);
                if (stmt instanceof ArkAssignStmt && stmt.getLeftOp() instanceof Local && fieldType != undefined) {
                    if (fieldType instanceof ArkField) {
                        if (fieldType.getModifiers().has("StaticKeyword")) {
                            stmt.setRightOp(new ArkStaticFieldRef(fieldType.getSignature()));
                        }
                        else {
                            // stmt.setRightOp(new ArkInstanceFieldRef(fieldType.getSignature()))
                            stmt.setRightOp(new ArkInstanceFieldRef(use.getBase(), fieldType.getSignature()));
                        }
                        stmt.getLeftOp().setType(fieldType.getType());
                    }
                    else if (fieldType instanceof ArkClass) {
                        stmt.getLeftOp().setType(fieldType.getSignature());
                    }
                }
            }
        }
        const stmtDef = stmt.getDef();
        if (stmtDef && stmtDef instanceof ArkInstanceFieldRef) {
            let fieldType = this.handleClassField(stmtDef, arkMethod);
            if (fieldType instanceof ArkField) {
                let fieldRef;
                if (fieldType.getModifiers().has("StaticKeyword")) {
                    fieldRef = new ArkStaticFieldRef(fieldType.getSignature());
                }
                else {
                    fieldRef = new ArkInstanceFieldRef(stmtDef.getBase(), fieldType.getSignature());
                }
                stmt.setDef(fieldRef);
                if (stmt instanceof ArkAssignStmt) {
                    // not sure
                    stmt.setLeftOp(fieldRef);
                }
            }
        }
    }
    handleClassField(field, arkMethod) {
        const base = field.getBase(), baseName = base.getName();
        const type = base.getType();
        const fieldName = field.getFieldName();
        let arkClass;
        if (!(type instanceof ClassType)) {
            arkClass = ModelUtils.getClassWithName(baseName, arkMethod);
            if (!arkClass) {
                const nameSpace = ModelUtils.getNamespaceWithName(baseName, arkMethod);
                if (!nameSpace) {
                    logger$6.warn("Unclear Base");
                    return;
                }
                const clas = ModelUtils.getClassInNamespaceWithName(fieldName, nameSpace);
                return clas;
            }
        }
        else {
            arkClass = ModelUtils.getClassWithClassSignature(type.getClassSignature(), this.scene);
            if (arkClass == null) {
                logger$6.warn(`class ${type.getClassSignature().getClassName()} does not exist`);
                return;
            }
        }
        const arkField = ModelUtils.getFieldInClassWithName(fieldName, arkClass);
        if (arkField == null) {
            logger$6.warn(`field ${fieldName} does not exist`);
            return;
        }
        let fieldType = arkField.getType();
        if (fieldType instanceof UnclearReferenceType) {
            const fieldTypeName = fieldType.getName();
            const fieldTypeClass = ModelUtils.getClassWithName(fieldTypeName, arkMethod);
            if (fieldTypeClass) {
                fieldType = new ClassType(fieldTypeClass.getSignature());
            }
            arkField.setType(fieldType);
        }
        return arkField;
    }
    static inferTypeInStmt(stmt, arkMethod) {
        var _a, _b;
        if (stmt instanceof ArkAssignStmt) {
            const leftOp = stmt.getLeftOp();
            if (leftOp instanceof Local) {
                const leftOpType = leftOp.getType();
                if (leftOpType instanceof AnnotationType) {
                    if (arkMethod === null) {
                        return;
                    }
                    let leftOpTypeString = leftOpType.getOriginType();
                    if (leftOpType instanceof AnnotationNamespaceType) {
                        let classSignature = (_a = ModelUtils.getClassWithName(leftOpTypeString, arkMethod)) === null || _a === void 0 ? void 0 : _a.getSignature();
                        if (classSignature === undefined) {
                            leftOp.setType(stmt.getRightOp().getType());
                        }
                        else {
                            leftOp.setType(new ClassType(classSignature));
                        }
                    }
                }
                else if (leftOpType instanceof UnknownType) {
                    const rightOp = stmt.getRightOp();
                    if (rightOp instanceof ArkParameterRef) {
                        let rightOpType = rightOp.getType();
                        if (rightOpType instanceof UnclearReferenceType) {
                            if (arkMethod == null)
                                return;
                            let classSignature = (_b = ModelUtils.getClassWithName(rightOpType.getName(), arkMethod)) === null || _b === void 0 ? void 0 : _b.getSignature();
                            if (classSignature === undefined) {
                                leftOp.setType(stmt.getRightOp().getType());
                            }
                            else {
                                leftOp.setType(new ClassType(classSignature));
                            }
                        }
                    }
                    else {
                        leftOp.setType(rightOp.getType());
                    }
                }
                else if (leftOpType instanceof UnionType) {
                    const rightOp = stmt.getRightOp();
                    leftOpType.setCurrType(rightOp.getType());
                }
                else if (leftOpType instanceof UnclearReferenceType) {
                    if (stmt.containsInvokeExpr()) ;
                }
            }
        }
    }
    static inferSimpleTypeInStmt(stmt) {
        if (stmt instanceof ArkAssignStmt) {
            const leftOp = stmt.getLeftOp();
            if (leftOp instanceof Local) {
                const leftOpType = leftOp.getType();
                if (leftOpType instanceof UnknownType) {
                    const rightOp = stmt.getRightOp();
                    leftOp.setType(rightOp.getType());
                }
            }
        }
    }
    // Deal only with simple situations
    static buildTypeFromStr(typeStr) {
        switch (typeStr) {
            case 'boolean':
                return BooleanType.getInstance();
            case 'number':
                return NumberType.getInstance();
            case 'string':
                return StringType.getInstance();
            case 'undefined':
                return UndefinedType.getInstance();
            case 'null':
                return NullType.getInstance();
            case 'any':
                return AnyType.getInstance();
            case 'void':
                return VoidType.getInstance();
            case 'never':
                return NeverType.getInstance();
            case 'RegularExpression':
                const classSignature = new ClassSignature();
                classSignature.setClassName('RegExp');
                return new ClassType(classSignature);
            default:
                return UnknownType.getInstance();
        }
    }
    static inferTypeOfBinopExpr(binopExpr) {
        const operator = binopExpr.getOperator();
        let op1Type = binopExpr.getOp1().getType();
        let op2Type = binopExpr.getOp2().getType();
        if (op1Type instanceof UnionType) {
            op1Type = op1Type.getCurrType();
        }
        if (op2Type instanceof UnionType) {
            op2Type = op2Type.getCurrType();
        }
        switch (operator) {
            case "+":
                if (op1Type === StringType.getInstance() || op2Type === StringType.getInstance()) {
                    return StringType.getInstance();
                }
                if (op1Type === NumberType.getInstance() && op2Type === NumberType.getInstance()) {
                    return NumberType.getInstance();
                }
                break;
            case "-":
            case "*":
            case "/":
            case "%":
                if (op1Type === NumberType.getInstance() && op2Type === NumberType.getInstance()) {
                    return NumberType.getInstance();
                }
                break;
            case "<":
            case "<=":
            case ">":
            case ">=":
            case "==":
            case "!=":
            case "===":
            case "!==":
            case "&&":
            case "||":
                return BooleanType.getInstance();
            case "&":
            case "|":
            case "^":
            case "<<":
            case ">>":
            case ">>>":
                if (op1Type === NumberType.getInstance() && op2Type === NumberType.getInstance()) {
                    return NumberType.getInstance();
                }
                break;
        }
        return UnknownType.getInstance();
    }
    inferMethodReturnType(method) {
        let methodReturnType = method.getReturnType();
        if (methodReturnType instanceof UnclearReferenceType) {
            let returnInstance = ModelUtils.getClassWithName(methodReturnType.getName(), method);
            if (returnInstance == null) {
                logger$6.warn("can not get method return value type: " +
                    method.getSignature().toString() + ": " + methodReturnType.getName());
            }
            else {
                method.setReturnType(new ClassType(returnInstance.getSignature()));
            }
        }
    }
}

class AbstractExpr {
}
class AbstractInvokeExpr extends AbstractExpr {
    constructor(methodSignature, args) {
        super();
        this.methodSignature = methodSignature;
        this.args = args;
    }
    getMethodSignature() {
        return this.methodSignature;
    }
    setMethodSignature(newMethodSignature) {
        this.methodSignature = newMethodSignature;
    }
    getArg(index) {
        return this.args[index];
    }
    getArgs() {
        return this.args;
    }
    setArgs(newArgs) {
        this.args = newArgs;
    }
    getType() {
        return this.methodSignature.getType();
    }
    getUses() {
        let uses = [];
        uses.push(...this.args);
        for (const arg of this.args) {
            uses.push(...arg.getUses());
        }
        return uses;
    }
}
class ArkInstanceInvokeExpr extends AbstractInvokeExpr {
    constructor(base, methodSignature, args) {
        super(methodSignature, args);
        this.base = base;
    }
    getBase() {
        return this.base;
    }
    setBase(newBase) {
        this.base = newBase;
    }
    getUses() {
        let uses = [];
        uses.push(this.base);
        uses.push(...this.base.getUses());
        uses.push(...this.getArgs());
        for (const arg of this.getArgs()) {
            uses.push(...arg.getUses());
        }
        return uses;
    }
    toString() {
        let strs = [];
        strs.push('instanceinvoke ');
        strs.push(this.base.toString());
        strs.push('.<');
        strs.push(this.getMethodSignature().toString());
        strs.push('>(');
        if (this.getArgs().length > 0) {
            for (const arg of this.getArgs()) {
                strs.push(arg.toString());
                strs.push(', ');
            }
            strs.pop();
        }
        strs.push(')');
        return strs.join('');
    }
}
class ArkStaticInvokeExpr extends AbstractInvokeExpr {
    constructor(methodSignature, args) {
        super(methodSignature, args);
    }
    toString() {
        let strs = [];
        strs.push('staticinvoke <');
        strs.push(this.getMethodSignature().toString());
        strs.push('>(');
        if (this.getArgs().length > 0) {
            for (const arg of this.getArgs()) {
                strs.push(arg.toString());
                strs.push(', ');
            }
            strs.pop();
        }
        strs.push(')');
        return strs.join('');
    }
}
class ArkNewExpr extends AbstractExpr {
    constructor(classType) {
        super();
        this.classType = classType;
    }
    getUses() {
        let uses = [];
        return uses;
    }
    getType() {
        return this.classType;
    }
    toString() {
        return 'new ' + this.classType;
    }
}
class ArkNewArrayExpr extends AbstractExpr {
    constructor(baseType, size) {
        super();
        this.baseType = baseType;
        this.size = size;
    }
    getSize() {
        return this.size;
    }
    setSize(newSize) {
        this.size = newSize;
    }
    getType() {
        // TODO: support multi-dimension array
        return new ArrayType(this.baseType, 1);
    }
    getBaseType() {
        return this.baseType;
    }
    setBaseType(newType) {
        this.baseType = newType;
    }
    getUses() {
        let uses = [this.size];
        uses.push(...this.size.getUses());
        return uses;
    }
    toString() {
        return 'newarray (' + this.baseType + ')[' + this.size + ']';
    }
}
// 二元运算表达式
class ArkBinopExpr extends AbstractExpr {
    constructor(op1, op2, operator) {
        super();
        this.op1 = op1;
        this.op2 = op2;
        this.operator = operator;
    }
    getOp1() {
        return this.op1;
    }
    setOp1(newOp1) {
        this.op1 = newOp1;
    }
    getOp2() {
        return this.op2;
    }
    setOp2(newOp2) {
        this.op2 = newOp2;
    }
    getOperator() {
        return this.operator;
    }
    getType() {
        return TypeInference.inferTypeOfBinopExpr(this);
    }
    getUses() {
        let uses = [];
        uses.push(this.op1);
        uses.push(...this.op1.getUses());
        uses.push(this.op2);
        uses.push(...this.op2.getUses());
        return uses;
    }
    toString() {
        return this.op1 + ' ' + this.operator + ' ' + this.op2;
    }
}
class ArkConditionExpr extends ArkBinopExpr {
    constructor(op1, op2, operator) {
        super(op1, op2, operator);
    }
}
class ArkTypeOfExpr extends AbstractExpr {
    constructor(op) {
        super();
        this.op = op;
    }
    getOp() {
        return this.op;
    }
    setOp(newOp) {
        this.op = newOp;
    }
    getUses() {
        let uses = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        return uses;
    }
    getType() {
        return this.op.getType();
    }
    toString() {
        return 'typeof ' + this.op;
    }
}
class ArkInstanceOfExpr extends AbstractExpr {
    constructor(op, checkType) {
        super();
        this.op = op;
        this.checkType = checkType;
    }
    getOp() {
        return this.op;
    }
    setOp(newOp) {
        this.op = newOp;
    }
    getType() {
        return BooleanType.getInstance();
    }
    getUses() {
        let uses = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        return uses;
    }
    toString() {
        return this.op + ' instanceof ' + this.checkType;
    }
}
class ArkLengthExpr extends AbstractExpr {
    constructor(op) {
        super();
        this.op = op;
    }
    getOp() {
        return this.op;
    }
    setOp(newOp) {
        this.op = newOp;
    }
    getType() {
        return NumberType.getInstance();
    }
    getUses() {
        let uses = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        return uses;
    }
    toString() {
        return 'lengthof ' + this.op;
    }
}
// 类型转换
class ArkCastExpr extends AbstractExpr {
    constructor(op, type) {
        super();
        this.op = op;
        this.type = type;
    }
    getOp() {
        return this.op;
    }
    setOp(newOp) {
        this.op = newOp;
    }
    getUses() {
        let uses = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        return uses;
    }
    getType() {
        return this.type;
    }
    toString() {
        return '<' + this.type + '>' + this.op;
    }
}
class ArkPhiExpr extends AbstractExpr {
    // private type:Type;
    constructor() {
        super();
        this.args = [];
        this.blockToArg = new Map();
        this.argToBlock = new Map();
    }
    getUses() {
        let uses = [];
        uses.push(...this.args);
        return uses;
    }
    getArgs() {
        return this.args;
    }
    setArgs(args) {
        this.args = args;
    }
    getArgToBlock() {
        return this.argToBlock;
    }
    setArgToBlock(argToBlock) {
        this.argToBlock = argToBlock;
    }
    getType() {
        return this.args[0].getType();
    }
    toString() {
        let strs = [];
        strs.push('phi(');
        if (this.args.length > 0) {
            for (const arg of this.args) {
                strs.push(arg.toString());
                strs.push(', ');
            }
            strs.pop();
        }
        strs.push(')');
        return strs.join('');
    }
}
// unary operation expression
class ArkUnopExpr extends AbstractExpr {
    constructor(op, operator) {
        super();
        this.op = op;
        this.operator = operator;
    }
    getUses() {
        let uses = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        return uses;
    }
    getType() {
        return this.op.getType();
    }
    getOperator() {
        return this.operator;
    }
    toString() {
        return this.operator + this.op;
    }
}
class ArrayLiteralExpr extends AbstractExpr {
    constructor(elements, type) {
        super();
        this.elements = [];
        this.elements = elements;
        this.type = type;
    }
    getUses() {
        let uses = [];
        uses.push();
        return uses;
    }
    getType() {
        return this.type;
    }
    toString() {
        //TODO
        return '';
    }
}
class ObjectLiteralExpr extends AbstractExpr {
    constructor(anonymousClass, type = ClassType) {
        super();
        this.anonymousClass = anonymousClass;
    }
    getAnonymousClass() {
        return this.anonymousClass;
    }
    getUses() {
        let uses = [];
        uses.push();
        return uses;
    }
    getType() {
        return this.type;
    }
    toString() {
        return this.anonymousClass.getSignature().toString();
    }
}

const logger$5 = ConsoleLogger.getLogger();
class MethodSignatureManager {
    constructor() {
        this._workList = [];
        this._processedList = [];
    }
    get workList() {
        return this._workList;
    }
    set workList(list) {
        this._workList = list;
    }
    get processedList() {
        return this._processedList;
    }
    set processedList(list) {
        this._processedList = list;
    }
    findInWorkList(signature) {
        return this.workList.find(item => item === signature);
    }
    findInProcessedList(signature) {
        let result = this.processedList.find(item => item.toString() === signature.toString());
        return typeof result !== "undefined";
    }
    addToWorkList(signature) {
        if (!isItemRegistered(signature, this.workList, (a, b) => a.toString() === b.toString())) {
            this.workList.push(signature);
        }
    }
    addToProcessedList(signature) {
        if (!isItemRegistered(signature, this.processedList, (a, b) => a === b)) {
            this.processedList.push(signature);
        }
    }
    removeFromWorkList(signature) {
        this.workList = this.workList.filter(item => item !== signature);
    }
    removeFromProcessedList(signature) {
        this.processedList = this.processedList.filter(item => item.toString() !== signature.toString());
    }
}
class SceneManager {
    get scene() {
        return this._scene;
    }
    set scene(value) {
        this._scene = value;
    }
    getMethod(method) {
        let targetMethod = this._scene.getMethod(method);
        if (targetMethod == null) {
            // 支持SDK调用解析
            let sdkMap = this.scene.getSdkArkFilestMap();
            for (let file of sdkMap.values()) {
                if (file.getFileSignature().toString() ==
                    method.getDeclaringClassSignature().getDeclaringFileSignature().toString()) {
                    const methods = file.getAllMethodsUnderThisFile();
                    for (let methodUnderFile of methods) {
                        if (method.toString() ==
                            methodUnderFile.getSignature().toString()) {
                            return methodUnderFile;
                        }
                    }
                }
            }
        }
        return targetMethod;
    }
    getClass(arkClass) {
        if (typeof arkClass.getClassName() === "undefined")
            return null;
        let classInstance = this._scene.getClass(arkClass);
        if (classInstance == null) {
            let sdkOrTargetProjectFile = this._scene.getSdkArkFilestMap()
                .get(arkClass.getDeclaringFileSignature().toString());
            // TODO: support get sdk class, targetProject class waiting to be supported
            if (sdkOrTargetProjectFile != null) {
                for (let classUnderFile of sdkOrTargetProjectFile.getAllClassesUnderThisFile()) {
                    if (classUnderFile.getSignature().toString() === arkClass.toString()) {
                        return classUnderFile;
                    }
                }
            }
        }
        return classInstance;
    }
    getExtendedClasses(arkClass) {
        let sourceClass = this.getClass(arkClass);
        let classList = [sourceClass]; // 待处理类
        let extendedClasses = []; // 已经处理的类
        while (classList.length > 0) {
            let tempClass = classList.shift();
            if (tempClass == null)
                continue;
            let firstLevelSubclasses = tempClass.getExtendedClasses();
            if (firstLevelSubclasses) {
                for (let subclass of firstLevelSubclasses) {
                    if (!isItemRegistered(subclass, extendedClasses, (a, b) => a.getSignature().toString() === b.getSignature().toString())) {
                        // 子类未处理，加入到classList
                        classList.push(subclass);
                    }
                }
            }
            // 当前类处理完毕，标记为已处理
            if (!isItemRegistered(tempClass, extendedClasses, (a, b) => a.getSignature().toString() === b.getSignature().toString())) {
                extendedClasses.push(tempClass);
            }
        }
        return extendedClasses;
    }
}
function isItemRegistered(item, array, compareFunc) {
    for (let tempItem of array) {
        if (compareFunc(tempItem, item)) {
            return true;
        }
    }
    return false;
}
function splitStringWithRegex(input) {
    // 正则表达式匹配 "a.b.c()" 并捕获 "a" "b" "c"
    const regex = /^(\w+)\.(\w+)\.(\w+)\(\)$/;
    const match = input.match(regex);
    if (match) {
        // 返回捕获的部分，忽略整个匹配结果
        return match.slice(1);
    }
    else {
        // 如果输入不匹配，返回空数组
        return [];
    }
}
function printCallGraphDetails(methods, calls, rootDir) {
    // 打印 Methods
    logger$5.info("Call Graph:\n");
    logger$5.info('\tMethods:');
    methods.forEach(method => {
        logger$5.info(`\t\t${method}`);
    });
    // 打印 Calls
    logger$5.info('\tCalls:');
    // 计算最长的method名称的长度，加上箭头和空格的长度
    Array.from(calls.keys()).reduce((max, method) => Math.max(max, method.toString().length), 0);
    const arrow = '->';
    calls.forEach((calledMethods, method) => {
        // 对于每个调用源，只打印一次调用源和第一个目标方法
        const modifiedMethodName = `<${method}`;
        logger$5.info(`\t\t${modifiedMethodName.padEnd(4)}   ${arrow}`);
        for (let i = 0; i < calledMethods.length; i++) {
            const modifiedCalledMethod = `\t\t<${calledMethods[i]}`;
            logger$5.info(`\t\t${modifiedCalledMethod}`);
        }
        logger$5.info("\n");
    });
}
function extractLastBracketContent(input) {
    // 正则表达式匹配最后一个尖括号内的内容，直到遇到左圆括号
    const match = input.match(/<([^<>]*)\(\)>$/);
    if (match && match[1]) {
        return match[1].trim();
    }
    return "";
}

class AbstractCallGraph {
    get signatureManager() {
        return this._signatureManager;
    }
    get scene() {
        return this._scene;
    }
    constructor(scene) {
        this.methods = new Set();
        this.calls = new Map();
        this._signatureManager = new MethodSignatureManager();
        this._scene = new SceneManager();
        this._scene.scene = scene;
    }
    loadCallGraph(entryPoints) {
        this.processWorkList(entryPoints);
    }
    /**
     * The main processing function of the call graph,
     * traversing the workList to handle function call relationships.
     *
     * @param entryPoints
     */
    processWorkList(entryPoints) {
        this.signatureManager.workList = entryPoints;
        while (this.signatureManager.workList.length != 0) {
            let methodSignature = this.signatureManager.workList.shift();
            // check whether the method need to be analyzed
            if (!this.checkMethodForAnalysis(methodSignature))
                continue;
            // pre process for RTA only
            this.preProcessMethod(methodSignature);
            // process the function and get the invoke targets of current function
            let invokeTargets = this.processMethod(methodSignature);
            // add invoke targets to workList
            // do not need to check the method, it will be filter in 'checkMethodForAnalysis()'
            for (let invokeTarget of invokeTargets) {
                this.signatureManager.addToWorkList(invokeTarget);
                this.addCall(methodSignature, invokeTarget);
            }
            // mark the current function as Processed
            this.signatureManager.addToProcessedList(methodSignature);
            this.addMethod(methodSignature);
        }
    }
    /**
     * Parse the body of the specific method to obtain the call relationships within the method.
     *
     * @param sourceMethodSignature
     */
    processMethod(sourceMethodSignature) {
        var _a;
        let invocationTargets = [];
        let cfg = (_a = this.scene.getMethod(sourceMethodSignature)) === null || _a === void 0 ? void 0 : _a.getBody().getCfg();
        if (typeof cfg !== "undefined") {
            for (let stmt of cfg.getStmts()) {
                if (stmt.containsInvokeExpr()) {
                    // Process the invocation statement using CHA (Class Hierarchy Analysis) and RTA (Rapid Type Analysis).
                    let invocationTargetsOfSingleMethod = this.resolveCall(sourceMethodSignature, stmt);
                    for (let invocationTarget of invocationTargetsOfSingleMethod) {
                        if (!isItemRegistered(invocationTarget, invocationTargets, (a, b) => a.toString() === b.toString())) {
                            invocationTargets.push(invocationTarget);
                        }
                    }
                }
            }
        }
        return invocationTargets;
    }
    addMethod(method) {
        if (this.getMethod(method) == null) {
            this.methods.add(method);
        }
    }
    hasMethod(method) {
        for (let methodOfList of this.methods) {
            if (method.toString() === methodOfList.toString()) {
                return true;
            }
        }
        return false;
    }
    addCall(source, target) {
        let targetMethods = this.getCall(source);
        if (targetMethods.length > 0) {
            if (!isItemRegistered(target, this.getCall(source), (a, b) => a.toString() === b.toString())) {
                // @ts-ignore
                this.calls.get(source).push(target);
            }
        }
        else {
            this.calls.set(source, [target]);
        }
    }
    getCalls() {
        return this.calls;
    }
    getMethods() {
        return this.methods;
    }
    getMethod(analyzedMethod) {
        for (const method of this.methods) {
            if (method.toString() === analyzedMethod.toString()) {
                return method;
            }
        }
        return null;
    }
    getCall(method) {
        for (const [key, value] of this.calls) {
            if (key.toString() === method.toString()) {
                return value;
            }
        }
        return [];
    }
    /**
     * check whether the method need to be analyzed
     * method need to be NotAnalyzedBefore, Project-ranged method
     *
     * @param method
     * @returns
     */
    checkMethodForAnalysis(method) {
        if (typeof method == "undefined")
            return false;
        if (this.signatureManager.findInProcessedList(method))
            return false;
        const ifProjectMethod = this.scene.scene.arkFiles.some(arkFile => arkFile.getFileSignature().toString() ===
            method.getDeclaringClassSignature().getDeclaringFileSignature().toString());
        return ifProjectMethod;
    }
}

class ClassHierarchyAnalysisAlgorithm extends AbstractCallGraph {
    resolveCall(sourceMethodSignature, invokeStmt) {
        let concreteMethodSignature = null;
        let callTargetMethods = [];
        let invokeExpressionExpr = invokeStmt.getInvokeExpr();
        if (invokeExpressionExpr === undefined) {
            return [];
        }
        let methodsFromInvoke = this.resolveInvokeExpr(invokeExpressionExpr, sourceMethodSignature.getDeclaringClassSignature().getDeclaringFileSignature().getFileName(), sourceMethodSignature);
        if (methodsFromInvoke == null) {
            return callTargetMethods;
        }
        for (let methodFromInvoke of methodsFromInvoke) {
            concreteMethodSignature = methodFromInvoke.getSignature();
            if (concreteMethodSignature == null) {
                // If the invoked function is static or a constructor, then return the signature.
                return callTargetMethods;
            }
            else if ((invokeExpressionExpr instanceof ArkStaticInvokeExpr)) {
                callTargetMethods.push(concreteMethodSignature);
                return callTargetMethods;
            }
            else {
                if (concreteMethodSignature.getMethodSubSignature().getMethodName() === "constructor") {
                    callTargetMethods.push(concreteMethodSignature);
                    return callTargetMethods;
                }
                // Obtain all possible target method signatures based on the acquired method signature.
                let targetMethodSignatures = this.resolveAllCallTargets(concreteMethodSignature);
                for (let targetMethodSignature of targetMethodSignatures) {
                    // remove abstract method
                    let targetMethod = this.scene.getMethod(targetMethodSignature);
                    if (targetMethod == null) {
                        continue;
                    }
                    if (!targetMethod.getDeclaringArkClass().getModifiers().has("AbstractKeyword") &&
                        !targetMethod.getModifiers().has("AbstractKeyword")) {
                        if (!isItemRegistered(targetMethod.getSignature(), callTargetMethods, (a, b) => a.toString() === b.toString())) {
                            callTargetMethods.push(targetMethodSignature);
                        }
                    }
                }
            }
        }
        return callTargetMethods;
    }
    /**
     * get all possible call target
     * get extended classes corresponding to target class
     * filter all method under the classes
     *
     * @param targetMethodSignature
     * @returns
     */
    resolveAllCallTargets(targetMethodSignature) {
        let targetClasses;
        let methodSignature = [];
        targetClasses = this.scene.getExtendedClasses(targetMethodSignature.getDeclaringClassSignature());
        for (let targetClass of targetClasses) {
            let methods = targetClass.getMethods();
            for (let method of methods) {
                if (method.getSubSignature().toString() === targetMethodSignature.getMethodSubSignature().toString()) {
                    if (!isItemRegistered(method.getSignature(), methodSignature, (a, b) => a.toString() === b.toString())) {
                        methodSignature.push(method.getSignature());
                    }
                }
            }
        }
        return methodSignature;
    }
    /**
     * resolve expr in the invoke stmt
     *
     * @param invokeExpr
     * @param arkFileName
     * @param sourceMethodSignature
     * @returns
     * instance invoke: get base variable class type, return corresponding method under class
     * static invoke: return normal static method and function invoke
     */
    resolveInvokeExpr(invokeExpr, arkFileName, sourceMethodSignature) {
        let callName = invokeExpr.getMethodSignature().getMethodSubSignature().getMethodName();
        let callMethods = [];
        // TODO: ts库、常用库未扫描，导致console.log等调用无法识别
        if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            let classCompleteType = invokeExpr.getBase().getType();
            if (classCompleteType instanceof ClassType) {
                let extendedClasses = this.scene.getExtendedClasses(classCompleteType.getClassSignature());
                for (let extendedClass of extendedClasses) {
                    for (let extendedMethod of extendedClass.getMethods()) {
                        if (extendedMethod.getName() === callName) {
                            if (!isItemRegistered(extendedMethod, callMethods, (a, b) => a.getSignature().toString() === b.getSignature().toString())) {
                                callMethods.push(extendedMethod);
                            }
                        }
                    }
                }
            }
        }
        else if (invokeExpr instanceof ArkStaticInvokeExpr) {
            let callFunction = this.scene.getMethod(invokeExpr.getMethodSignature());
            if (callFunction != null) {
                if (!isItemRegistered(callFunction, callMethods, (a, b) => a.getSignature().toString() === b.getSignature().toString())) {
                    callMethods.push(callFunction);
                }
            }
        }
        return callMethods;
    }
    preProcessMethod(methodSignature) {
        //do nothing
    }
}

class RapidTypeAnalysisAlgorithm extends AbstractCallGraph {
    constructor() {
        super(...arguments);
        this.instancedClasses = new Set();
        this.ignoredCalls = new Map();
    }
    resolveCall(sourceMethodSignature, invokeStmt) {
        let concreteMethodSignature;
        let callTargetMethods = [];
        let invokeExpressionExpr = invokeStmt.getInvokeExpr();
        if (invokeExpressionExpr === undefined) {
            return [];
        }
        let methodsFromInvoke = this.resolveInvokeExpr(invokeExpressionExpr, sourceMethodSignature.getDeclaringClassSignature().getDeclaringFileSignature().getFileName(), sourceMethodSignature);
        if (methodsFromInvoke == null) {
            return callTargetMethods;
        }
        for (let methodFromInvoke of methodsFromInvoke) {
            concreteMethodSignature = methodFromInvoke.getSignature();
            if (concreteMethodSignature == null) {
                // If the invoked function is static or a constructor, then return the signature.
                return callTargetMethods;
            }
            else if ((invokeExpressionExpr instanceof ArkStaticInvokeExpr)) {
                callTargetMethods.push(concreteMethodSignature);
                return callTargetMethods;
            }
            else {
                if (concreteMethodSignature.getMethodSubSignature().getMethodName() === "constructor") {
                    callTargetMethods.push(concreteMethodSignature);
                    return callTargetMethods;
                }
                // Obtain all possible target method signatures based on the acquired method signature.
                let targetMethodSignatures = this.resolveAllCallTargets(concreteMethodSignature);
                for (let targetMethodSignature of targetMethodSignatures) {
                    // remove abstract method
                    let targetMethod = this.scene.getMethod(targetMethodSignature);
                    if (targetMethod == null) {
                        continue;
                    }
                    if (!targetMethod.getDeclaringArkClass().getModifiers().has("AbstractKeyword") &&
                        !targetMethod.getModifiers().has("AbstractKeyword")) {
                        if (this.getInstancedClass(targetMethod.getDeclaringArkClass().getSignature()) !== null) {
                            if (!isItemRegistered(targetMethod.getSignature(), callTargetMethods, (a, b) => a.toString() === b.toString())) {
                                callTargetMethods.push(targetMethodSignature);
                            }
                        }
                        else {
                            this.saveIgnoredCalls(sourceMethodSignature, targetMethod.getSignature());
                        }
                    }
                }
            }
        }
        return callTargetMethods;
    }
    resolveAllCallTargets(targetMethodSignature) {
        let targetClasses;
        let methodSignature = [];
        targetClasses = this.scene.getExtendedClasses(targetMethodSignature.getDeclaringClassSignature());
        for (let targetClass of targetClasses) {
            let methods = targetClass.getMethods();
            for (let method of methods) {
                if (method.getSubSignature().toString() === targetMethodSignature.getMethodSubSignature().toString()) {
                    if (!isItemRegistered(method.getSignature(), methodSignature, (a, b) => a.toString() === b.toString())) {
                        methodSignature.push(method.getSignature());
                    }
                }
            }
        }
        return methodSignature;
    }
    /**
     * Preprocessing of the RTA method:
     * For the method being processed,
     * get all the newly instantiated classes within the method body,
     * and re-add the edges previously ignored from these classes back into the Call collection.
     *
     * @param methodSignature
     * @protected
     */
    preProcessMethod(methodSignature) {
        // 获取当前函数中新实例化的类
        let instancedClasses = this.collectInstantiatedClassesInMethod(methodSignature);
        const newlyInstancedClasses = instancedClasses.filter(item => !(this.getInstancedClass(item) != null));
        for (let newInstancedClass of newlyInstancedClasses) {
            // Soot中前处理没看明白，先写个简单版本
            // Check from the ignoredCalls collection whether there are edges that need to be reactivated.
            let ignoredCallsOfSpecificClass = this.getIgnoredCalls(newInstancedClass);
            if (ignoredCallsOfSpecificClass.length != 0) {
                for (let edge of ignoredCallsOfSpecificClass) {
                    this.addCall(edge[0], edge[1]);
                    this.signatureManager.addToWorkList(edge[1]);
                }
                this.ignoredCalls.delete(newInstancedClass);
            }
            this.addInstancedClass(newInstancedClass);
        }
    }
    /**
     * Retrieve the newly created class objects within the method.(WIP)
     *
     * @param methodSignature
     * @protected
     */
    collectInstantiatedClassesInMethod(methodSignature) {
        // TODO: 需要考虑怎么收集不在当前method方法内的instancedClass
        //       确定哪些范围的变量需要收集信息
        let cfg = this.scene.getMethod(methodSignature).getCfg();
        let newInstancedClass;
        newInstancedClass = [];
        for (let stmt of cfg.getStmts()) {
            // TODO: 判断语句类型，如果是赋值语句且创建了新的实例，则获取类签名
            let stmtExpr = stmt.getExprs()[0];
            if (stmtExpr instanceof ArkNewExpr) {
                let classSignature = stmtExpr.getType().getClassSignature();
                if (classSignature != null) {
                    if (!isItemRegistered(classSignature, newInstancedClass, (a, b) => a.toString() === b.toString())) {
                        newInstancedClass.push(classSignature);
                    }
                }
            }
        }
        return newInstancedClass;
    }
    resolveInvokeExpr(invokeExpr, arkFileName, sourceMethodSignature) {
        let callName = invokeExpr.getMethodSignature().getMethodSubSignature().getMethodName();
        let classAndArkFileNames = new Set();
        let callMethods = [];
        if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            // logger.info("instanceInvoke:   "+invokeExpr.getMethodSignature().toString())
            let classCompleteType = invokeExpr.getBase().getType();
            if (classCompleteType instanceof ClassType) {
                let extendedClasses = this.scene.getExtendedClasses(classCompleteType.getClassSignature());
                for (let extendedClass of extendedClasses) {
                    for (let extendedMethod of extendedClass.getMethods()) {
                        if (extendedMethod.getName() === callName) {
                            if (!isItemRegistered(extendedMethod, callMethods, (a, b) => a.getSignature().toString() === b.getSignature().toString())) {
                                callMethods.push(extendedMethod);
                            }
                        }
                    }
                }
            }
        }
        else if (invokeExpr instanceof ArkStaticInvokeExpr) {
            // logger.info("static:   "+invokeExpr.getMethodSignature().toString())
            if (callName.includes('.')) {
                // a.b()的静态调用
                let lastDotIndex = callName.lastIndexOf('.');
                let className = callName.substring(0, lastDotIndex);
                if (className === "this") {
                    let currentClass = this.scene.getClass(sourceMethodSignature.getDeclaringClassSignature());
                    classAndArkFileNames.add([currentClass.getName(),
                        currentClass.getDeclaringArkFile().getName()]);
                }
                else {
                    classAndArkFileNames.add([className, arkFileName]);
                    callName.substring(lastDotIndex + 1);
                }
            }
            else {
                // 函数调用
                let callFunction = this.scene.getMethod(invokeExpr.getMethodSignature());
                if (callFunction != null) {
                    if (!isItemRegistered(callFunction, callMethods, (a, b) => a.getSignature().toString() === b.getSignature().toString())) {
                        callMethods.push(callFunction);
                    }
                }
            }
        }
        return callMethods;
    }
    saveIgnoredCalls(sourceMethodSignature, targetMethodSignature) {
        let notInstancedClassSignature = targetMethodSignature.getDeclaringClassSignature();
        // notice: 是被调用函数的类没有实例化才会被加入边，且调用关系会以被调用函数类作为key
        let ignoredCallsOfSpecificClass = this.getIgnoredCalls(notInstancedClassSignature);
        const callExists = ignoredCallsOfSpecificClass.some(ignoredCall => ignoredCall[0].toString() === sourceMethodSignature.toString() &&
            ignoredCall[1].toString() === targetMethodSignature.toString());
        if (callExists) {
            return;
        }
        if (ignoredCallsOfSpecificClass.length != 0) {
            // 当前集合中已经存在该类被忽略的边
            ignoredCallsOfSpecificClass.push([sourceMethodSignature, targetMethodSignature]);
        }
        else {
            this.ignoredCalls.set(notInstancedClassSignature, [[sourceMethodSignature, targetMethodSignature]]);
        }
    }
    getIgnoredCalls(sourceClassSignature) {
        for (let keyClassSignature of this.ignoredCalls.keys()) {
            if (keyClassSignature.toString() === sourceClassSignature.toString()) {
                return this.ignoredCalls.get(keyClassSignature);
            }
        }
        return [];
    }
    deleteIgnoredCalls(sourceClassSignature) {
        for (let keyClassSignature of this.ignoredCalls.keys()) {
            if (keyClassSignature.toString() === sourceClassSignature.toString()) {
                this.ignoredCalls.delete(keyClassSignature);
            }
        }
    }
    addInstancedClass(classSignature) {
        for (let instanceClass of this.instancedClasses) {
            if (instanceClass.toString() === classSignature.toString()) {
                return;
            }
        }
        this.instancedClasses.add(classSignature);
    }
    getInstancedClass(classSignature) {
        for (let classSig of this.instancedClasses) {
            if (classSig.toString() === classSignature.toString()) {
                return classSig;
            }
        }
        return null;
    }
}

// TODO: 对指向目标进行细分，后续PointerTarget将作为抽象类
class PointerTarget {
    constructor(type, location) {
        this.type = type;
        this.location = location;
    }
    getType() {
        return this.type;
    }
    getLocation() {
        return this.location;
    }
    static genLocation(method, stmt) {
        return method.toString() + stmt.getOriginPositionInfo();
    }
}
/**
 * 指针需要全局唯一，需要根据语句信息确定唯一位置
 */
class Pointer {
    constructor() {
        this.pointerTargetSet = new Set();
    }
    addPointerTarget(newPointerTarget) {
        for (let pointerTarget of this.pointerTargetSet) {
            if (pointerTarget.getLocation() == newPointerTarget.getLocation()) {
                return;
            }
        }
        this.pointerTargetSet.add(newPointerTarget);
    }
    getPointerTarget(specificPointerTarget) {
        for (let pointerTarget of this.pointerTargetSet) {
            if (pointerTarget == specificPointerTarget) {
                return pointerTarget;
            }
        }
        return null;
    }
    getAllPointerTargets() {
        let results = [];
        for (let pointerTarget of this.pointerTargetSet) {
            results.push(pointerTarget);
        }
        return results;
    }
}
class LocalPointer extends Pointer {
    constructor(identifier) {
        super();
        this.identifier = identifier;
    }
    getIdentifier() {
        return this.identifier;
    }
    toString() {
        let resultString = "[LocalPointer] ";
        resultString += this.getIdentifier().getName() + " pointer: {";
        const pointerTargets = this.getAllPointerTargets();
        for (let pointerTarget of pointerTargets) {
            resultString += " " + pointerTarget.getType() + "." + pointerTarget.getLocation();
        }
        return resultString + "}";
    }
}
/**
 * TODO: 需要考虑在调用类的属性的时候如何将同一个类的不同实例区分开
 * 目前想法是让InstanceFieldPointer的标识符属性改成LocalPointer，这样能够区分具体构造位置
 */
class InstanceFieldPointer extends Pointer {
    constructor(basePointerTarget, field) {
        super();
        this.basePointerTarget = basePointerTarget;
        this.fieldSignature = field;
    }
    getBasePointerTarget() {
        return this.basePointerTarget;
    }
    getFieldSignature() {
        return this.fieldSignature;
    }
    toString() {
        let resultString = "[InstanceFieldPointer] ";
        resultString += this.getBasePointerTarget().getType()
            + "." + this.fieldSignature.getFieldName() + " pointer: {";
        const pointerTargets = this.getAllPointerTargets();
        for (let pointerTarget of pointerTargets) {
            resultString += " " + pointerTarget.getType() + "." + pointerTarget.getLocation();
        }
        return resultString + "}";
    }
}
class StaticFieldPointer extends Pointer {
    constructor(field) {
        super();
        this.fieldSignature = field;
    }
    getFieldSignature() {
        return this.fieldSignature;
    }
    toString() {
        let resultString = "[StaticFieldPointer] ";
        resultString += this.fieldSignature.getDeclaringClassSignature().getClassName() + "."
            + this.fieldSignature.getFieldName() + " pointer: {";
        const pointerTargets = this.getAllPointerTargets();
        for (let pointerTarget of pointerTargets) {
            resultString += " " + pointerTarget.getType() + "." + pointerTarget.getLocation();
        }
        return resultString + "}";
    }
}
class PointerTargetPair {
    constructor(pointer, pointerTarget) {
        this.pointer = pointer;
        this.pointerTarget = pointerTarget;
    }
    getPointer() {
        return this.pointer;
    }
    getPointerTarget() {
        return this.pointerTarget;
    }
}

const logger$4 = ConsoleLogger.getLogger();
class PointerFlowGraph {
    constructor() {
        this.pointerFlowEdges = new Map();
        this.pointerSet = new Set();
    }
    /**
     * 指针的传播过程
     */
    proPagate(pointer, pointerTarget) {
        const newWorkList = [];
        const initialPointerSetOfIdentifier = pointer;
        // merge pointer into identifier pointerSet
        this.addPointerSetElement(initialPointerSetOfIdentifier, pointerTarget);
        const pointerFlowEdgesTargets = this.getPointerFlowEdges(initialPointerSetOfIdentifier);
        for (let pointerFlowEdge of pointerFlowEdgesTargets) {
            newWorkList.push(new PointerTargetPair(pointerFlowEdge, pointerTarget));
        }
        return newWorkList;
    }
    getPointerSet() {
        return this.pointerSet;
    }
    getPointerSetElement(identifier, pointerTarget, fieldSignature) {
        const pointerSet = this.getPointerSet();
        for (let set of pointerSet) {
            if (fieldSignature != null) {
                if (pointerTarget != null && set instanceof InstanceFieldPointer) {
                    if (set.getBasePointerTarget() === pointerTarget &&
                        set.getFieldSignature().toString() === fieldSignature.toString()) {
                        return set;
                    }
                }
                else if (set instanceof StaticFieldPointer) {
                    if (set.getFieldSignature().toString() === fieldSignature.toString()) {
                        return set;
                    }
                }
            }
            else if (identifier != null && set instanceof LocalPointer) {
                if (set.getIdentifier() === identifier) {
                    return set;
                }
            }
        }
        let newPointer = null;
        if (fieldSignature != null) {
            if (pointerTarget == null) {
                newPointer = new StaticFieldPointer(fieldSignature);
            }
            else {
                newPointer = new InstanceFieldPointer(pointerTarget, fieldSignature);
            }
        }
        else {
            newPointer = new LocalPointer(identifier);
        }
        this.pointerSet.add(newPointer);
        return newPointer;
    }
    addPointerSetElement(pointerSet, pointer) {
        pointerSet.addPointerTarget(pointer);
    }
    getPointerFlowEdges(sourcePointer) {
        return this.pointerFlowEdges.get(sourcePointer) || [];
    }
    addPointerFlowEdge(sourcePointer, targetPointer) {
        let newWorkList = [];
        if (!this.hasPointerFlowEdge(sourcePointer, targetPointer)) {
            const targets = this.pointerFlowEdges.get(sourcePointer) || [];
            targets.push(targetPointer);
            this.pointerFlowEdges.set(sourcePointer, targets);
            // this.pointerSet.add(sourcePointer);
            // this.pointerSet.add(targetPointer);
            let pointers = sourcePointer.getAllPointerTargets();
            for (let point of pointers) {
                newWorkList.push(new PointerTargetPair(targetPointer, point));
            }
        }
        return newWorkList;
    }
    hasPointerFlowEdge(sourcePointer, targetPointer) {
        if (this.pointerFlowEdges.has(sourcePointer)) {
            // If it does, check if the targetPointer is in the array of targets
            const targets = this.pointerFlowEdges.get(sourcePointer);
            return targets ? targets.includes(targetPointer) : false;
        }
        return false;
    }
    printPointerFlowGraph() {
        logger$4.info("PointerFlowGraph Elements: ");
        for (let element of this.getPointerSet()) {
            logger$4.info("\t" + element.toString());
        }
        logger$4.info("PointerFlowGraph Edges: ");
        for (let element of this.pointerFlowEdges.keys()) {
            logger$4.info("\t" + element.toString());
            for (let values of this.getPointerFlowEdges(element)) {
                logger$4.info("\t\t" + values.toString());
            }
        }
    }
}

const logger$3 = ConsoleLogger.getLogger();
class VariablePointerAnalysisAlogorithm extends AbstractCallGraph {
    constructor(scene) {
        super(scene);
        this.workList = [];
        this.reachableStmts = [];
        this.reachableMethods = [];
        this.pointerFlowGraph = new PointerFlowGraph();
        this.CHAtool = this.scene.scene.makeCallGraphCHA([]);
    }
    loadCallGraph(entryPoints) {
        this.processWorkList(entryPoints);
        this.pointerFlowGraph.printPointerFlowGraph();
    }
    processWorkList(entryPoints) {
        this.addReachable(entryPoints);
        while (this.workList.length != 0) {
            let workElement = this.workList.shift();
            let pointerSet, identifier;
            // workList的结构是[指针，指向目标]
            let pointer = workElement.getPointer(), pointerTarget = workElement.getPointerTarget();
            if (pointer instanceof LocalPointer) {
                identifier = pointer.getIdentifier();
                pointerSet = this.pointerFlowGraph.getPointerSetElement(identifier, null, null);
            }
            else if (pointer instanceof InstanceFieldPointer) {
                identifier = pointer.getBasePointerTarget();
                pointerSet = this.pointerFlowGraph.getPointerSetElement(null, identifier, pointer.getFieldSignature());
            }
            else if (pointer instanceof StaticFieldPointer) {
                pointerSet = this.pointerFlowGraph.getPointerSetElement(null, null, pointer.getFieldSignature());
            }
            // 检查当前指针是否已经存在于对应指针集中
            if (!(pointerSet.getPointerTarget(pointerTarget) == null)) {
                continue;
            }
            let newWorkListItems = this.pointerFlowGraph.proPagate(pointerSet, pointerTarget);
            for (let newWorkLisItem of newWorkListItems) {
                this.workList.push(newWorkLisItem);
            }
            if (identifier instanceof Local) {
                this.processFieldReferenceStmt(identifier, pointerTarget);
                this.processInstanceInvokeStmt(identifier, pointerTarget);
            }
        }
    }
    resolveCall(sourceMethodSignature, invokeStmt) {
        throw new Error("Method not implemented.");
    }
    preProcessMethod(methodSignature) {
        throw new Error("Method not implemented.");
    }
    addReachable(entryPoints) {
        for (let method of entryPoints) {
            // logger.info("[addReachable] processing method: "+method.toString())
            if (isItemRegistered(method, this.reachableMethods, (a, b) => a.toString() === b.toString())) {
                continue;
            }
            this.reachableMethods.push(method);
            let arkMethodInstance = this.scene.getMethod(method);
            if (arkMethodInstance == null)
                continue;
            let stmts = arkMethodInstance.getCfg().getStmts();
            this.reachableStmts.push(...stmts);
            for (let stmt of stmts) {
                if (stmt instanceof ArkAssignStmt) {
                    let leftOp = stmt.getLeftOp(), rightOp = stmt.getRightOp();
                    if (!(leftOp instanceof Local)) {
                        continue;
                    }
                    if (rightOp instanceof ArkNewExpr) {
                        let classType = rightOp.getType();
                        let pointer = new PointerTarget(classType, PointerTarget.genLocation(method, stmt));
                        // logger.info("\t[addReachable] find new expr in method, add workList: "+(leftOp as Local).getName()+" -> "+pointer.getType())
                        this.workList.push(new PointerTargetPair(this.pointerFlowGraph.getPointerSetElement(leftOp, null, null), pointer));
                    }
                    else if (rightOp instanceof Local) {
                        // logger.info("\t[addReachable] find assign expr in method, add pointer flow edge: "+(rightOp as Local).getName()+" -> "+(leftOp as Local).getType())
                        this.addEdgeIntoPointerFlowGraph(this.pointerFlowGraph.getPointerSetElement(rightOp, null, null), this.pointerFlowGraph.getPointerSetElement(leftOp, null, null));
                    }
                    else if (rightOp instanceof ArkStaticInvokeExpr) {
                        let targetMethod = this.scene.getMethod(rightOp.getMethodSignature());
                        if (targetMethod == null) {
                            continue;
                        }
                        this.addReachable([targetMethod.getSignature()]);
                        this.processInvokePointerFlow(arkMethodInstance, targetMethod, stmt);
                    }
                }
                else if (stmt instanceof ArkInvokeStmt) {
                    let invokeExpr = stmt.getInvokeExpr();
                    if (invokeExpr instanceof ArkStaticInvokeExpr) {
                        let targetMethod = this.scene.getMethod(invokeExpr.getMethodSignature());
                        if (targetMethod == null) {
                            continue;
                        }
                        this.addReachable([invokeExpr.getMethodSignature()]);
                        this.processInvokePointerFlow(arkMethodInstance, targetMethod, stmt);
                    }
                }
            }
        }
    }
    processInstanceInvokeStmt(identifier, pointer) {
        var _a;
        // logger.info("[processInvokeStmt] process identifier: "+(identifier as Local).getName())
        for (let stmt of this.reachableStmts) {
            if (stmt.containsInvokeExpr()) {
                let expr = stmt.getInvokeExpr();
                if (expr === undefined) {
                    continue;
                }
                // 判断是否是当前identifier的调用语句，否则continue
                if (expr instanceof ArkInstanceInvokeExpr) {
                    // TODO: constructor调用
                    if (identifier != expr.getBase()) {
                        continue;
                    }
                }
                else if (expr instanceof ArkStaticInvokeExpr) {
                    continue;
                }
                let sourceMethod = (_a = stmt.getCfg()) === null || _a === void 0 ? void 0 : _a.getDeclaringMethod();
                let targetMethod = this.getSpecificCallTarget(expr, pointer);
                if (targetMethod == null) {
                    continue;
                }
                targetMethod.getSignature();
                // logger.info("\t[processInvokeStmt] get specific call target: "+specificCallTarget.toString()+", from stmt: "+stmt.toString())
                let targetMethodThisInstance = targetMethod.getThisInstance();
                if (targetMethodThisInstance == null) {
                    continue;
                }
                // logger.info("\t[processInvokeStmt] add pointer to call target this instance: "+pointer.getType())
                this.workList.push(new PointerTargetPair(this.pointerFlowGraph.getPointerSetElement(targetMethodThisInstance, null, null), pointer));
                this.processInvokePointerFlow(sourceMethod, targetMethod, stmt);
            }
        }
    }
    processFieldReferenceStmt(identifier, pointerTarget) {
        // 将field的存与取操作合并
        for (let stmt of this.reachableStmts) {
            // TODO: getFieldRef接口可能包含了左值
            if (stmt instanceof ArkAssignStmt && stmt.containsFieldRef()) {
                // TODO: 对namespace中取field会拆分为两条语句，需要进行区分
                let fieldRef;
                if ((fieldRef = this.getFieldRefFromUse(stmt)) != undefined) {
                    // 取属性
                    let fieldSignature = fieldRef.getFieldSignature();
                    if (fieldRef instanceof ArkInstanceFieldRef) {
                        let fieldBase = fieldRef.getBase();
                        if (fieldBase !== identifier) {
                            continue;
                        }
                        this.addEdgeIntoPointerFlowGraph(this.pointerFlowGraph.getPointerSetElement(null, pointerTarget, fieldSignature), this.pointerFlowGraph.getPointerSetElement(stmt.getLeftOp(), null, null));
                    }
                    else if (fieldRef instanceof ArkStaticFieldRef) {
                        this.addEdgeIntoPointerFlowGraph(this.pointerFlowGraph.getPointerSetElement(null, null, fieldSignature), this.pointerFlowGraph.getPointerSetElement(stmt.getLeftOp(), null, null));
                    }
                }
                else if ((fieldRef = this.getFieldFromDef(stmt)) != undefined) {
                    // 存属性
                    let fieldSignature = fieldRef.getFieldSignature();
                    if (fieldRef instanceof ArkInstanceFieldRef) {
                        let fieldBase = fieldRef.getBase();
                        if (fieldBase !== identifier) {
                            continue;
                        }
                        this.addEdgeIntoPointerFlowGraph(this.pointerFlowGraph.getPointerSetElement(stmt.getRightOp(), null, null), this.pointerFlowGraph.getPointerSetElement(null, pointerTarget, fieldSignature));
                    }
                    else if (fieldRef instanceof ArkStaticFieldRef) {
                        this.addEdgeIntoPointerFlowGraph(this.pointerFlowGraph.getPointerSetElement(stmt.getRightOp(), null, null), this.pointerFlowGraph.getPointerSetElement(null, null, fieldRef.getFieldSignature()));
                    }
                }
            }
        }
    }
    processInvokePointerFlow(sourceMethod, targetMethod, stmt) {
        if (isItemRegistered(targetMethod.getSignature(), this.getCall(sourceMethod.getSignature()), (a, b) => a.toString() === b.toString())) {
            return;
        }
        // 如果当前调用关系没有被记录
        let expr = stmt.getInvokeExpr();
        if (expr == undefined) {
            return;
        }
        let sourceMethodSignature = sourceMethod.getSignature();
        let targetMethodSignature = targetMethod.getSignature();
        this.addCall(sourceMethodSignature, targetMethodSignature);
        this.addMethod(sourceMethodSignature);
        // 将被调用方法加入到可到达集合中
        this.addReachable([targetMethodSignature]);
        let parameters = expr.getArgs();
        let methodParameterInstances = targetMethod.getParameterInstances();
        // logger.info("[processInvokeStmt] add pointer flow edges for invoke stmt parameter")
        for (let i = 0; i < parameters.length; i++) {
            // 参数指针传递
            this.addEdgeIntoPointerFlowGraph(this.pointerFlowGraph.getPointerSetElement(parameters[i], null, null), this.pointerFlowGraph.getPointerSetElement(methodParameterInstances[i], null, null));
        }
        if (stmt instanceof ArkAssignStmt) {
            let returnValues = targetMethod.getReturnValues();
            for (let returnValue of returnValues) {
                this.addEdgeIntoPointerFlowGraph(this.pointerFlowGraph.getPointerSetElement(returnValue, null, null), this.pointerFlowGraph.getPointerSetElement(stmt.getLeftOp(), null, null));
            }
        }
    }
    addEdgeIntoPointerFlowGraph(source, target) {
        let newWorkListItems = this.pointerFlowGraph.addPointerFlowEdge(source, target);
        for (let newWorkListItem of newWorkListItems) {
            this.workList.push(newWorkListItem);
        }
    }
    getSpecificCallTarget(expr, pointerTarget) {
        let type = pointerTarget.getType();
        if (!(type instanceof ClassType)) {
            return null;
        }
        let arkClassInstance = this.scene.getClass(type.getClassSignature());
        if (arkClassInstance == null) {
            logger$3.error("can not resolve classtype: " + type.toString());
            return null;
        }
        const methodInstances = arkClassInstance.getMethods();
        for (let method of methodInstances) {
            if (method.getSignature().getMethodSubSignature().toString() === expr.getMethodSignature().getMethodSubSignature().toString()) {
                return method;
            }
        }
        return null;
    }
    getFieldRefFromUse(stmt) {
        for (let use of stmt.getUses()) {
            if (use instanceof AbstractFieldRef) {
                return use;
            }
        }
    }
    getFieldFromDef(stmt) {
        let def = stmt.getDef();
        if (def instanceof AbstractFieldRef) {
            return def;
        }
    }
    updateVariableType() {
    }
}

class ArkNamespace {
    constructor() {
        this.line = -1;
        this.column = -1;
        this.declaringArkNamespace = null;
        this.modifiers = new Set();
        this.exportInfos = [];
        this.namespaces = [];
        this.classes = [];
    }
    getMethodAllTheNamespace(methodSignature) {
        let classSig = methodSignature.getDeclaringClassSignature();
        let cls = this.getClassAllTheNamespace(classSig);
        if (cls) {
            return cls.getMethod(methodSignature);
        }
        return null;
    }
    getClassAllTheNamespace(classSignature) {
        if (classSignature.getDeclaringFileSignature().toString() != this.getNamespaceSignature().getDeclaringFileSignature().toString()) {
            return null;
        }
        let nsSig = classSignature.getDeclaringNamespaceSignature();
        if (nsSig) {
            let ns = this.getNamespaceAllTheNamespace(nsSig);
            if (ns) {
                return ns.getClassAllTheNamespace(classSignature);
            }
        }
        return null;
    }
    addNamespace(namespace) {
        this.namespaces.push(namespace);
    }
    getNamespace(namespaceSignature) {
        const foundNamespace = this.namespaces.find(ns => ns.getNamespaceSignature().toString() == namespaceSignature.toString());
        return foundNamespace || null;
    }
    getNamespaceAllTheNamespace(namespaceSignature) {
        let returnVal = null;
        let declaringNamespaceSignature = namespaceSignature.getDeclaringNamespaceSignature();
        if (!declaringNamespaceSignature) {
            return null;
        }
        if (declaringNamespaceSignature.toString() == this.namespaceSignature.toString()) {
            this.namespaces.forEach((ns) => {
                if (ns.getNamespaceSignature().toString() == namespaceSignature.toString()) {
                    returnVal = ns;
                }
            });
        }
        else {
            let declaringNamespace = this.getNamespaceAllTheNamespace(declaringNamespaceSignature);
            if (declaringNamespace) {
                returnVal = declaringNamespace.getNamespace(namespaceSignature);
            }
        }
        return returnVal;
    }
    getNamespaces() {
        return this.namespaces;
    }
    genNamespaceSignature() {
        let namespaceSignature = new NamespaceSignature();
        namespaceSignature.setNamespaceName(this.name);
        namespaceSignature.setDeclaringFileSignature(this.declaringArkFile.getFileSignature());
        if (this.declaringArkNamespace) {
            namespaceSignature.setDeclaringNamespaceSignature(this.declaringArkNamespace.getNamespaceSignature());
        }
        this.namespaceSignature = namespaceSignature;
    }
    getNamespaceSignature() {
        return this.namespaceSignature;
    }
    getName() {
        return this.name;
    }
    setName(name) {
        this.name = name;
    }
    getCode() {
        return this.code;
    }
    setCode(code) {
        this.code = code;
    }
    getLine() {
        return this.line;
    }
    setLine(line) {
        this.line = line;
    }
    getColumn() {
        return this.column;
    }
    setColumn(column) {
        this.column = column;
    }
    setEtsPositionInfo(position) {
        this.etsPosition = position;
    }
    getEtsPositionInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.etsPosition) {
                let arkFile = this.declaringArkFile;
                const etsPosition = yield arkFile.getEtsOriginalPositionFor(new LineColPosition(this.line, this.column));
                this.setEtsPositionInfo(etsPosition);
            }
            return this.etsPosition;
        });
    }
    setDeclaringType(declaringType) {
        this.declaringType = declaringType;
    }
    getDeclaringType() {
        return this.declaringType;
    }
    getDeclaringInstance() {
        return this.declaringInstance;
    }
    setDeclaringInstance(declaringInstance) {
        this.declaringInstance = declaringInstance;
    }
    getDeclaringArkFile() {
        return this.declaringArkFile;
    }
    setDeclaringArkFile(declaringArkFile) {
        this.declaringArkFile = declaringArkFile;
    }
    getDeclaringArkNamespace() {
        return this.declaringArkNamespace;
    }
    setDeclaringArkNamespace(declaringArkNamespace) {
        this.declaringArkNamespace = declaringArkNamespace;
    }
    getModifiers() {
        return this.modifiers;
    }
    addModifier(name) {
        this.modifiers.add(name);
    }
    containsModifier(name) {
        return this.modifiers.has(name);
    }
    getClass(classSignature) {
        const foundClass = this.classes.find(cls => cls.getSignature().toString() == classSignature.toString());
        return foundClass || null;
    }
    getClasses() {
        return this.classes;
    }
    updateClass(arkClass) {
        for (let i = 0; i < this.classes.length; i++) {
            if (this.classes[i].getSignature().toString() == arkClass.getSignature().toString()) {
                this.classes.splice(i, 1);
            }
        }
        this.classes.push(arkClass);
    }
    addArkClass(arkClass) {
        if (this.getClass(arkClass.getSignature())) {
            this.updateClass(arkClass);
        }
        else {
            this.classes.push(arkClass);
        }
    }
    isExported() {
        return this.containsModifier('ExportKeyword');
    }
    getExportInfos() {
        return this.exportInfos;
    }
    addExportInfos(exportInfo) {
        this.exportInfos.push(exportInfo);
    }
    getDefaultClass() {
        return this.defaultClass;
    }
    setDefaultClass(defaultClass) {
        this.defaultClass = defaultClass;
    }
    getAllMethodsUnderThisNamespace() {
        let methods = [];
        this.classes.forEach((cls) => {
            methods.push(...cls.getMethods());
        });
        this.namespaces.forEach((ns) => {
            methods.push(...ns.getAllMethodsUnderThisNamespace());
        });
        return methods;
    }
    getAllClassesUnderThisNamespace() {
        let classes = [];
        classes.push(...this.classes);
        this.namespaces.forEach((ns) => {
            classes.push(...ns.getAllClassesUnderThisNamespace());
        });
        return classes;
    }
    getAllNamespacesUnderThisNamespace() {
        let namespaces = [];
        namespaces.push(...this.namespaces);
        this.namespaces.forEach((ns) => {
            namespaces.push(...ns.getAllNamespacesUnderThisNamespace());
        });
        return namespaces;
    }
}
function buildArkNamespace(nsNode, declaringInstance, ns) {
    if (!nsNode.namespaceNodeInfo) {
        throw new Error('Error: There is no namespaceNodeInfo for this ModuleDeclaration!');
    }
    ns.setName(nsNode.namespaceNodeInfo.getName());
    if (declaringInstance instanceof ArkFile) {
        ns.setDeclaringType("ArkFile");
        ns.setDeclaringArkFile(declaringInstance);
    }
    else {
        ns.setDeclaringType("ArkNamespace");
        ns.setDeclaringArkNamespace(declaringInstance);
        ns.setDeclaringArkFile(declaringInstance.getDeclaringArkFile());
    }
    ns.setDeclaringInstance(declaringInstance);
    ns.genNamespaceSignature();
    nsNode.namespaceNodeInfo.getModifiers().forEach((modifier) => {
        ns.addModifier(modifier);
    });
    ns.setCode(nsNode.text);
    ns.setLine(nsNode.line + 1);
    ns.setColumn(nsNode.character + 1);
    let tmpNode = findIndicatedChild$1(nsNode, "ModuleBlock");
    if (tmpNode) {
        tmpNode = findIndicatedChild$1(tmpNode, "SyntaxList");
    }
    if (tmpNode) {
        genDefaultArkClass$1(tmpNode, ns);
        buildNamespaceMembers(tmpNode, ns);
    }
}
// TODO: check and update
function buildNamespaceMembers(nsNode, namespace) {
    var _a;
    for (let child of nsNode.children) {
        if (child.kind == 'ModuleDeclaration') {
            let ns = new ArkNamespace();
            buildArkNamespace(child, namespace, ns);
            namespace.addNamespace(ns);
            if (ns.isExported()) {
                let isDefault = namespace.getModifiers().has("DefaultKeyword");
                addExportInfo$1(ns, namespace, isDefault);
            }
        }
        if (child.kind == 'ClassDeclaration' || child.kind == 'InterfaceDeclaration' || child.kind == 'EnumDeclaration') {
            let cls = new ArkClass();
            buildNormalArkClassFromArkNamespace(child, namespace, cls);
            namespace.addArkClass(cls);
            if (cls.isExported()) {
                let isDefault = cls.getModifiers().has("DefaultKeyword");
                addExportInfo$1(cls, namespace, isDefault);
            }
        }
        if (arkMethodNodeKind.indexOf(child.kind) > -1) {
            let mthd = new ArkMethod();
            buildArkMethodFromArkClass(child, namespace.getDefaultClass(), mthd);
            namespace.getDefaultClass().addMethod(mthd);
            if (mthd.isExported()) {
                let isDefault = mthd.getModifiers().has("DefaultKeyword");
                addExportInfo$1(mthd, namespace, isDefault);
            }
        }
        if (child.kind == 'ExportDeclaration' || child.kind == 'ExportAssignment') {
            (_a = child.exportNodeInfo) === null || _a === void 0 ? void 0 : _a.forEach((element) => {
                if (findIndicatedChild$1(child, 'DefaultKeyword')) {
                    element.setDefault(true);
                }
                namespace.addExportInfos(element);
            });
        }
        if (child.kind == 'VariableStatement' || child.kind == 'FirstStatement') {
            //check ExportKeyword
            let childSyntaxNode = findIndicatedChild$1(child, 'SyntaxList');
            let isDefault = findIndicatedChild$1(child, 'DefaultKeyword') ? true : false;
            if (childSyntaxNode) {
                if (findIndicatedChild$1(childSyntaxNode, 'ExportKeyword')) {
                    processExportValAndFirstNode$1(child, namespace, isDefault);
                }
            }
        }
    }
}
function genDefaultArkClass$1(defaultClassNode, ns) {
    let defaultClass = new ArkClass();
    buildDefaultArkClassFromArkNamespace(defaultClassNode, ns, defaultClass);
    ns.setDefaultClass(defaultClass);
    ns.addArkClass(defaultClass);
}
function findIndicatedChild$1(node, childType) {
    for (let child of node.children) {
        if (child.kind == childType) {
            return child;
        }
    }
    return null;
}
function processExportValAndFirstNode$1(node, ns, isDefault) {
    let exportClauseName = '';
    let exportClauseType = node.kind;
    let cld = findIndicatedChild$1(node, 'VariableDeclarationList');
    if (cld) {
        let c = findIndicatedChild$1(cld, 'SyntaxList');
        if (c) {
            let cc = findIndicatedChild$1(c, 'VariableDeclaration');
            if (cc) {
                let ccc = findIndicatedChild$1(cc, 'Identifier');
                if (ccc) {
                    exportClauseName = ccc.text;
                }
            }
        }
    }
    let exportInfo = new ExportInfo();
    exportInfo.build(exportClauseName, exportClauseType);
    exportInfo.setDefault(isDefault);
    ns.addExportInfos(exportInfo);
}
function addExportInfo$1(arkInstance, ns, isDefault) {
    let exportClauseName = arkInstance.getName();
    let exportClauseType;
    if (arkInstance instanceof ArkMethod) {
        exportClauseType = "Method";
    }
    else if (arkInstance instanceof ArkClass) {
        exportClauseType = "Class";
    }
    else {
        exportClauseType = "ArkNamespace";
    }
    let exportInfo = new ExportInfo();
    exportInfo.build(exportClauseName, exportClauseType);
    exportInfo.setDefault(isDefault);
    ns.addExportInfos(exportInfo);
}

const notStmtOrExprKind = ['ModuleDeclaration', 'ClassDeclaration', 'InterfaceDeclaration', 'EnumDeclaration', 'ExportDeclaration',
    'ExportAssignment', 'MethodDeclaration', 'Constructor', 'FunctionDeclaration', 'GetAccessor', 'SetAccessor', 'ArrowFunction',
    'FunctionExpression', 'MethodSignature', 'ConstructSignature', 'CallSignature'];
/**
 *
 */
class ArkFile {
    constructor() {
        this.projectName = "";
        this.namespaces = [];
        this.classes = [];
        this.importInfos = [];
        this.exportInfos = [];
    }
    setName(name) {
        this.name = name;
    }
    getName() {
        return this.name;
    }
    setScene(scene) {
        this.scene = scene;
    }
    getScene() {
        return this.scene;
    }
    setProjectDir(projectDir) {
        this.projectDir = projectDir;
    }
    getProjectDir() {
        return this.projectDir;
    }
    getFilePath() {
        return this.absoluteFilePath;
    }
    setFilePath(absoluteFilePath) {
        this.absoluteFilePath = absoluteFilePath;
    }
    setCode(code) {
        this.code = code;
    }
    getCode() {
        return this.code;
    }
    updateClass(arkClass) {
        for (let i = 0; i < this.classes.length; i++) {
            if (this.classes[i].getSignature().toString() == arkClass.getSignature().toString()) {
                this.classes.splice(i, 1);
            }
        }
        this.classes.push(arkClass);
    }
    addArkClass(arkClass) {
        if (this.getClass(arkClass.getSignature())) {
            this.updateClass(arkClass);
        }
        else {
            this.classes.push(arkClass);
        }
    }
    getDefaultClass() {
        return this.defaultClass;
    }
    setDefaultClass(defaultClass) {
        this.defaultClass = defaultClass;
    }
    getNamespace(namespaceSignature) {
        const foundNamespace = this.namespaces.find(ns => ns.getNamespaceSignature().toString() == namespaceSignature.toString());
        return foundNamespace || null;
    }
    getNamespaces() {
        return this.namespaces;
    }
    getClass(classSignature) {
        const foundClass = this.classes.find(cls => cls.getSignature().toString() == classSignature.toString());
        return foundClass || null;
    }
    getClasses() {
        return this.classes;
    }
    addNamespace(namespace) {
        this.namespaces.push(namespace);
    }
    getMethodAllTheFile(methodSignature) {
        let returnVal = null;
        let namespaceSig = methodSignature.getDeclaringClassSignature().getDeclaringNamespaceSignature();
        if (namespaceSig != null) {
            let namespace = this.getNamespaceAllTheFile(namespaceSig);
            if (namespace) {
                returnVal = namespace.getMethodAllTheNamespace(methodSignature);
            }
        }
        else {
            let classSig = methodSignature.getDeclaringClassSignature();
            let cls = this.getClass(classSig);
            if (cls) {
                returnVal = cls.getMethod(methodSignature);
            }
        }
        return returnVal;
    }
    getClassAllTheFile(classSignature) {
        let returnVal = null;
        let fileSig = classSignature.getDeclaringFileSignature();
        if (fileSig.toString() != this.fileSignature.toString()) {
            return null;
        }
        else {
            let namespaceSig = classSignature.getDeclaringNamespaceSignature();
            if (namespaceSig) {
                let ns = this.getNamespaceAllTheFile(namespaceSig);
                if (ns) {
                    returnVal = ns.getClass(classSignature);
                }
            }
            else {
                returnVal = this.getClass(classSignature);
            }
        }
        return returnVal;
    }
    getNamespaceAllTheFile(namespaceSignature) {
        let returnVal = null;
        let declaringNamespaceSignature = namespaceSignature.getDeclaringNamespaceSignature();
        if (!declaringNamespaceSignature) {
            this.namespaces.forEach((ns) => {
                if (ns.getNamespaceSignature().toString() == namespaceSignature.toString()) {
                    returnVal = ns;
                }
            });
        }
        else {
            let declaringNamespace = this.getNamespaceAllTheFile(declaringNamespaceSignature);
            if (declaringNamespace) {
                returnVal = declaringNamespace.getNamespace(namespaceSignature);
            }
        }
        return returnVal;
    }
    getImportInfos() {
        return this.importInfos;
    }
    addImportInfos(importInfo) {
        this.importInfos.push(importInfo);
    }
    getExportInfos() {
        return this.exportInfos;
    }
    addExportInfos(exportInfo) {
        this.exportInfos.push(exportInfo);
    }
    setProjectName(projectName) {
        this.projectName = projectName;
    }
    getProjectName() {
        return this.projectName;
    }
    genFileSignature() {
        let fileSignature = new FileSignature();
        fileSignature.setFileName(this.name);
        fileSignature.setProjectName(this.projectName);
        this.fileSignature = fileSignature;
    }
    getFileSignature() {
        return this.fileSignature;
    }
    getAllMethodsUnderThisFile() {
        let methods = [];
        this.classes.forEach((cls) => {
            methods.push(...cls.getMethods());
        });
        this.namespaces.forEach((ns) => {
            methods.push(...ns.getAllMethodsUnderThisNamespace());
        });
        return methods;
    }
    getAllClassesUnderThisFile() {
        let classes = [];
        classes.push(...this.classes);
        this.namespaces.forEach((ns) => {
            classes.push(...ns.getAllClassesUnderThisNamespace());
        });
        return classes;
    }
    getAllNamespacesUnderThisFile() {
        let namespaces = [];
        namespaces.push(...this.namespaces);
        this.namespaces.forEach((ns) => {
            namespaces.push(...ns.getAllNamespacesUnderThisNamespace());
        });
        return namespaces;
    }
    initSourceMap() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.sourceMap) {
                return;
            }
            let mapFilePath = this.getFilePath() + '.map';
            if (fs__default.existsSync(mapFilePath)) {
                this.sourceMap = yield new sourceMap.SourceMapConsumer(fs__default.readFileSync(mapFilePath, 'utf-8'));
            }
        });
    }
    getEtsOriginalPositionFor(position) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (position.getColNo() < 0 || position.getLineNo() < 1) {
                return new LineColPosition(0, 0);
            }
            yield this.initSourceMap();
            let result = (_a = this.sourceMap) === null || _a === void 0 ? void 0 : _a.originalPositionFor({
                line: position.getLineNo(),
                column: position.getColNo(),
                bias: sourceMap.SourceMapConsumer.LEAST_UPPER_BOUND
            });
            if (result && result.line) {
                return new LineColPosition(result.line, result.column);
            }
            return new LineColPosition(0, 0);
        });
    }
    getEtsSource(line) {
        return __awaiter(this, void 0, void 0, function* () {
            if (line < 1) {
                return '';
            }
            yield this.initSourceMap();
            let map = this.sourceMap.sources[0];
            if (!fs__default.existsSync(map)) {
                map = path.join(path.dirname(this.absoluteFilePath), map);
            }
            if (!fs__default.existsSync(map)) {
                return '';
            }
            let lines = fs__default.readFileSync(map, 'utf8').split('\n');
            if (lines.length < line) {
                return '';
            }
            return lines.slice(0, line).join('\n');
        });
    }
}
function buildArkFileFromFile(absoluteFilePath, projectDir, arkFile) {
    arkFile.setFilePath(absoluteFilePath);
    arkFile.setProjectDir(projectDir);
    arkFile.setName(path.relative(projectDir, absoluteFilePath));
    arkFile.genFileSignature();
    arkFile.setCode(fs__default.readFileSync(absoluteFilePath, 'utf8'));
    const astTree = new ASTree(arkFile.getCode());
    genDefaultArkClass(arkFile, astTree);
    buildArkFile(arkFile, astTree);
}
function buildArkFile(arkFile, astTree) {
    var _a, _b, _c;
    let children = (_a = astTree.root) === null || _a === void 0 ? void 0 : _a.children;
    for (let child of children) {
        if (child.kind == 'ModuleDeclaration') {
            let ns = new ArkNamespace();
            ns.setDeclaringArkFile(arkFile);
            buildArkNamespace(child, arkFile, ns);
            arkFile.addNamespace(ns);
            if (ns.isExported()) {
                let isDefault = ns.getModifiers().has("DefaultKeyword");
                addExportInfo(ns, arkFile, isDefault);
            }
        }
        if (child.kind == 'ClassDeclaration' || child.kind == 'InterfaceDeclaration' || child.kind == 'EnumDeclaration') {
            let cls = new ArkClass();
            buildNormalArkClassFromArkFile(child, arkFile, cls);
            arkFile.addArkClass(cls);
            if (cls.isExported()) {
                let isDefault = cls.getModifiers().has("DefaultKeyword");
                addExportInfo(cls, arkFile, isDefault);
            }
        }
        if (arkMethodNodeKind.indexOf(child.kind) > -1) {
            let mthd = new ArkMethod();
            buildArkMethodFromArkClass(child, arkFile.getDefaultClass(), mthd);
            arkFile.getDefaultClass().addMethod(mthd);
            if (mthd.isExported()) {
                let isDefault = mthd.getModifiers().has("DefaultKeyword");
                addExportInfo(mthd, arkFile, isDefault);
            }
        }
        if (child.kind == 'ImportDeclaration' || child.kind == 'ImportEqualsDeclaration') {
            (_b = child.importNodeInfo) === null || _b === void 0 ? void 0 : _b.forEach((element) => {
                element.setDeclaringFilePath(arkFile.getFilePath());
                element.setProjectPath(arkFile.getProjectDir());
                element.setDeclaringArkFile(arkFile);
                element.setImportFromSignature();
                arkFile.addImportInfos(element);
            });
        }
        if (child.kind == 'ExportDeclaration' || child.kind == 'ExportAssignment') {
            (_c = child.exportNodeInfo) === null || _c === void 0 ? void 0 : _c.forEach((element) => {
                if (findIndicatedChild(child, 'DefaultKeyword')) {
                    element.setDefault(true);
                }
                let elementImportInfo = element.getImportInfo();
                if (elementImportInfo) {
                    elementImportInfo.setDeclaringFilePath(arkFile.getFilePath());
                    elementImportInfo.setProjectPath(arkFile.getProjectDir());
                    elementImportInfo.setDeclaringArkFile(arkFile);
                    elementImportInfo.setImportFromSignature();
                    arkFile.addImportInfos(elementImportInfo);
                }
                arkFile.addExportInfos(element);
            });
        }
        if (child.kind == 'VariableStatement' || child.kind == 'FirstStatement') {
            //check ExportKeyword
            let childSyntaxNode = findIndicatedChild(child, 'SyntaxList');
            let isDefault = findIndicatedChild(child, 'DefaultKeyword') ? true : false;
            if (childSyntaxNode) {
                if (findIndicatedChild(childSyntaxNode, 'ExportKeyword')) {
                    processExportValAndFirstNode(child, arkFile, isDefault);
                }
            }
        }
    }
}
function genDefaultArkClass(arkFile, astTree) {
    let defaultClass = new ArkClass();
    buildDefaultArkClassFromArkFile(astTree.root, arkFile, defaultClass);
    arkFile.setDefaultClass(defaultClass);
    arkFile.addArkClass(defaultClass);
}
function findIndicatedChild(node, childType) {
    for (let child of node.children) {
        if (child.kind == childType) {
            return child;
        }
    }
    return null;
}
function processExportValAndFirstNode(node, arkFile, isDefault) {
    let exportClauseName = '';
    let exportClauseType = node.kind;
    let cld = findIndicatedChild(node, 'VariableDeclarationList');
    if (cld) {
        let c = findIndicatedChild(cld, 'SyntaxList');
        if (c) {
            let cc = findIndicatedChild(c, 'VariableDeclaration');
            if (cc) {
                let ccc = findIndicatedChild(cc, 'Identifier');
                if (ccc) {
                    exportClauseName = ccc.text;
                }
            }
        }
    }
    let exportInfo = new ExportInfo();
    exportInfo.build(exportClauseName, exportClauseType);
    exportInfo.setDefault(isDefault);
    arkFile.addExportInfos(exportInfo);
}
function addExportInfo(arkInstance, arkFile, isDefault) {
    let exportClauseName = arkInstance.getName();
    let exportClauseType;
    if (arkInstance instanceof ArkMethod) {
        exportClauseType = "Method";
    }
    else if (arkInstance instanceof ArkClass) {
        exportClauseType = "Class";
    }
    else {
        exportClauseType = "ArkNamespace";
    }
    let exportInfo = new ExportInfo();
    exportInfo.build(exportClauseName, exportClauseType);
    exportInfo.setDefault(isDefault);
    arkFile.addExportInfos(exportInfo);
}

const logger$2 = ConsoleLogger.getLogger();
class VisibleValue {
    constructor() {
        // TODO:填充全局变量
        this.currScope = new Scope([], 0);
        this.scopeChain = [this.currScope];
        this.currVisibleValues = [...this.currScope.values];
    }
    /** get values that is visible in curr scope */
    getCurrVisibleValues() {
        return this.currVisibleValues;
    }
    getScopeChain() {
        return this.scopeChain;
    }
    /** udpate visible values after entered a scope, only support step by step */
    updateIntoScope(model) {
        let name = '';
        if (model instanceof BasicBlock) {
            name = 'block: ' + model.toString();
        }
        else {
            name = model.getName();
        }
        logger$2.info('---- into scope:{', name, '}');
        // get values in this scope
        let values = [];
        if (model instanceof ArkFile || model instanceof ArkNamespace) {
            values = this.getVisibleValuesIntoFileOrNameSpace(model);
        }
        else if (model instanceof ArkClass) {
            values = this.getVisibleValuesIntoClass(model);
        }
        else if (model instanceof ArkMethod) {
            values = this.getVisibleValuesIntoMethod(model);
        }
        else if (model instanceof BasicBlock) {
            values = this.getVisibleValuesIntoBasicBlock(model);
        }
        // handle scope chain
        const targetDepth = this.getTargetDepth(model);
        this.addScope(values, targetDepth, model);
    }
    /** udpate visible values after left a scope, only support step by step */
    updateOutScope() {
        const currModel = this.currScope.arkModel;
        let name = '';
        if (currModel instanceof BasicBlock) {
            name = 'block: ' + currModel.toString();
        }
        else {
            name = currModel.getName();
        }
        logger$2.info('---- out scope:{', name, '}');
        let targetDepth = this.currScope.depth;
        if (currModel instanceof BasicBlock) {
            const successorsCnt = currModel.getSuccessors().length;
            // if successorsCnt <= 0, unchange
            if (successorsCnt > 1) {
                targetDepth += 1; // goto inner scope
            }
        }
        this.deleteScope(targetDepth);
    }
    /** clear up previous scope */
    deleteScope(targetDepth) {
        const prevDepth = this.currScope.depth;
        if (targetDepth > prevDepth) {
            return;
        }
        let popScopeValuesCnt = 0;
        let popScopeCnt = 0;
        for (let i = this.scopeChain.length - 1; i >= 0; i--) {
            if (this.scopeChain[i].depth < targetDepth) {
                break;
            }
            popScopeCnt += 1;
            popScopeValuesCnt += this.scopeChain[i].values.length;
        }
        this.scopeChain.splice(this.scopeChain.length - popScopeCnt, popScopeCnt)[0]; // popScopeCnt >= 1
        this.currScope = this.scopeChain[this.scopeChain.length - 1];
        const totalValuesCnt = this.currVisibleValues.length;
        this.currVisibleValues.splice(totalValuesCnt - popScopeValuesCnt, popScopeValuesCnt);
    }
    /** add this scope to scope chain and update visible values */
    addScope(values, targetDepth, model) {
        const newScope = new Scope(values, targetDepth, model);
        this.currScope = newScope;
        this.scopeChain.push(this.currScope);
        this.currVisibleValues.push(...this.currScope.values);
    }
    // TODO:构造嵌套关系树
    getTargetDepth(model) {
        const prevDepth = this.currScope.depth;
        const prevModel = this.currScope.arkModel;
        let targetDepth = prevDepth + 1;
        if (model instanceof BasicBlock) {
            const predecessorsCnt = model.getPredecessors().length;
            if (predecessorsCnt <= 1) {
                targetDepth = prevDepth + 1;
            }
            else {
                targetDepth = prevDepth;
            }
        }
        else if ((model instanceof ArkFile) && (prevModel instanceof ArkFile)) {
            targetDepth = prevDepth;
        }
        else if ((model instanceof ArkNamespace) && (prevModel instanceof ArkNamespace)) {
            targetDepth = prevDepth;
        }
        else if ((model instanceof ArkClass) && (prevModel instanceof ArkClass)) {
            targetDepth = prevDepth;
        }
        else if ((model instanceof ArkMethod) && (prevModel instanceof ArkMethod)) {
            targetDepth = prevDepth;
        }
        return targetDepth;
    }
    getVisibleValuesIntoFileOrNameSpace(fileOrNameSpace) {
        let values = [];
        return values;
    }
    getVisibleValuesIntoClass(cls) {
        const values = [];
        const fields = cls.getFields();
        const classSignature = cls.getSignature();
        for (const field of fields) {
            if (field.getModifiers().has('StaticKeyword')) {
                const staticFieldRef = new ArkStaticFieldRef(field.getSignature());
                values.push(staticFieldRef);
            }
            else {
                const instanceFieldRef = new ArkInstanceFieldRef(new Local('this', new ClassType(classSignature)), field.getSignature());
                values.push(instanceFieldRef);
            }
        }
        return values;
    }
    getVisibleValuesIntoMethod(method) {
        let visibleValues = [];
        return visibleValues;
    }
    getVisibleValuesIntoBasicBlock(basiceBlock) {
        const visibleValues = [];
        for (const stmt of basiceBlock.getStmts()) {
            if (stmt instanceof ArkAssignStmt) {
                visibleValues.push(stmt.getLeftOp());
            }
        }
        return visibleValues;
    }
}
class Scope {
    constructor(values, depth = -1, arkModel = null) {
        this.values = values;
        this.depth = depth;
        this.arkModel = arkModel;
    }
}

const logger$1 = ConsoleLogger.getLogger();
/**
 * The Scene class includes everything in the analyzed project.
 * We should be able to re-generate the project's code based on this class.
 */
class Scene {
    constructor(sceneConfig) {
        this.projectName = '';
        this.projectFiles = [];
        this.arkFiles = [];
        //sdkArkFiles: ArkFile[] = [];
        this.targetProjectArkFilesMap = new Map();
        this.sdkArkFilestMap = new Map();
        this.extendedClasses = new Map();
        this.globalImportInfos = [];
        this.sdkFilesProjectMap = new Map();
        // values that are visible in curr scope
        this.visibleValue = new VisibleValue();
        // all classes and methods, just for demo
        this.allClasses = [];
        this.allMethods = [];
        this.classCached = new Map();
        this.projectName = sceneConfig.getTargetProjectName();
        this.projectFiles = sceneConfig.getProjectFiles();
        this.realProjectDir = fs__default.realpathSync(sceneConfig.getTargetProjectDirectory());
        this.realProjectOriginDir = fs__default.realpathSync(sceneConfig.getTargetProjectOriginDirectory());
        this.ohosSdkPath = sceneConfig.getOhosSdkPath();
        this.kitSdkPath = sceneConfig.getKitSdkPath();
        this.systemSdkPath = sceneConfig.getSystemSdkPath();
        this.sdkFilesProjectMap = sceneConfig.getSdkFilesMap();
        this.otherSdkMap = sceneConfig.getOtherSdkMap();
        // add sdk reative path to Import builder
        this.configImportSdkPrefix();
        this.genArkFiles();
        //post actions
        this.collectProjectImportInfos();
    }
    configImportSdkPrefix() {
        if (this.ohosSdkPath) {
            updateSdkConfigPrefix("ohos", path.relative(this.realProjectDir, this.ohosSdkPath));
        }
        if (this.kitSdkPath) {
            updateSdkConfigPrefix("kit", path.relative(this.realProjectDir, this.kitSdkPath));
        }
        if (this.systemSdkPath) {
            updateSdkConfigPrefix("system", path.relative(this.realProjectDir, this.systemSdkPath));
        }
        if (this.otherSdkMap) {
            this.otherSdkMap.forEach((value, key) => {
                updateSdkConfigPrefix(key, path.relative(this.realProjectDir, value));
            });
        }
    }
    genArkFiles() {
        this.sdkFilesProjectMap.forEach((value, key) => {
            if (key.length != 0) {
                const sdkProjectName = value;
                let realSdkProjectDir = "";
                if (sdkProjectName == "ohos") {
                    realSdkProjectDir = fs__default.realpathSync(this.ohosSdkPath);
                }
                else if (sdkProjectName == "kit") {
                    realSdkProjectDir = fs__default.realpathSync(this.kitSdkPath);
                }
                else if (sdkProjectName == "system") {
                    realSdkProjectDir = fs__default.realpathSync(this.systemSdkPath);
                }
                else {
                    let sdkPath = this.otherSdkMap.get(value);
                    if (sdkPath) {
                        realSdkProjectDir = fs__default.realpathSync(sdkPath);
                    }
                }
                key.forEach((file) => {
                    logger$1.info('=== parse file:', file);
                    let arkFile = new ArkFile();
                    arkFile.setProjectName(sdkProjectName);
                    buildArkFileFromFile(file, realSdkProjectDir, arkFile);
                    arkFile.setScene(this);
                    this.sdkArkFilestMap.set(arkFile.getFileSignature().toString(), arkFile);
                });
            }
        });
        this.projectFiles.forEach((file) => {
            logger$1.info('=== parse file:', file);
            let arkFile = new ArkFile();
            arkFile.setProjectName(this.projectName);
            buildArkFileFromFile(file, this.realProjectDir, arkFile);
            arkFile.setScene(this);
            this.arkFiles.push(arkFile);
            this.targetProjectArkFilesMap.set(arkFile.getFileSignature().toString(), arkFile);
        });
    }
    getFile(fileSignature) {
        const foundFile = this.arkFiles.find(fl => fl.getFileSignature().toString() == fileSignature.toString());
        return foundFile || null;
    }
    getFiles() {
        return this.arkFiles;
    }
    getTargetProjectArkFilesMap() {
        return this.targetProjectArkFilesMap;
    }
    getSdkArkFilestMap() {
        return this.sdkArkFilestMap;
    }
    getNamespace(namespaceSignature) {
        let returnVal = null;
        if (namespaceSignature instanceof NamespaceSignature) {
            let fileSig = namespaceSignature.getDeclaringFileSignature();
            this.arkFiles.forEach((fl) => {
                if (fl.getFileSignature().toString() == fileSig.toString()) {
                    returnVal = fl.getNamespaceAllTheFile(namespaceSignature);
                }
            });
        }
        else {
            this.getAllNamespacesUnderTargetProject().forEach((ns) => {
                if (ns.getNamespaceSignature().toString() == namespaceSignature) {
                    returnVal = ns;
                }
            });
        }
        return returnVal;
    }
    getClass(classSignature) {
        let classSearched = null;
        if (classSignature instanceof ClassSignature) {
            if (this.classCached.has(classSignature)) {
                classSearched = this.classCached.get(classSignature) || null;
            }
            else {
                const fileSig = classSignature.getDeclaringFileSignature().toString();
                const arkFile = this.targetProjectArkFilesMap.get(fileSig);
                if (arkFile) {
                    classSearched = arkFile.getClassAllTheFile(classSignature);
                }
                this.classCached.set(classSignature, classSearched);
            }
        }
        else {
            this.getAllClassesUnderTargetProject().forEach((cls) => {
                if (cls.getSignature().toString() == classSignature) {
                    classSearched = cls;
                }
            });
        }
        return classSearched;
    }
    getMethod(methodSignature) {
        let returnVal = null;
        if (methodSignature instanceof MethodSignature) {
            let fileSig = methodSignature.getDeclaringClassSignature().getDeclaringFileSignature();
            this.arkFiles.forEach((fl) => {
                if (fl.getFileSignature().toString() == fileSig.toString()) {
                    returnVal = fl.getMethodAllTheFile(methodSignature);
                }
            });
        }
        else {
            this.getAllMethodsUnderTargetProject().forEach((mtd) => {
                if (mtd.getSignature().toString() == methodSignature) {
                    returnVal = mtd;
                }
            });
        }
        return returnVal;
    }
    getAllNamespacesUnderTargetProject() {
        let namespaces = [];
        this.arkFiles.forEach((fl) => {
            namespaces.push(...fl.getAllNamespacesUnderThisFile());
        });
        return namespaces;
    }
    getAllClassesUnderTargetProject() {
        if (this.allClasses.length == 0) {
            this.arkFiles.forEach((fl) => {
                this.allClasses.push(...fl.getAllClassesUnderThisFile());
            });
        }
        return this.allClasses;
    }
    getAllMethodsUnderTargetProject() {
        if (this.allMethods.length == 0) {
            this.arkFiles.forEach((fl) => {
                this.allMethods.push(...fl.getAllMethodsUnderThisFile());
            });
        }
        return this.allMethods;
    }
    hasMainMethod() {
        return false;
    }
    //Get the set of entry points that are used to build the call graph.
    getEntryPoints() {
        return [];
    }
    /** get values that is visible in curr scope */
    getVisibleValue() {
        return this.visibleValue;
    }
    makeCallGraphCHA(entryPoints) {
        let callGraphCHA;
        callGraphCHA = new ClassHierarchyAnalysisAlgorithm(this);
        callGraphCHA.loadCallGraph(entryPoints);
        return callGraphCHA;
    }
    makeCallGraphRTA(entryPoints) {
        let callGraphRTA;
        callGraphRTA = new RapidTypeAnalysisAlgorithm(this);
        callGraphRTA.loadCallGraph(entryPoints);
        return callGraphRTA;
    }
    makeCallGraphVPA(entryPoints) {
        // WIP context-insensitive 上下文不敏感
        let callGraphVPA;
        callGraphVPA = new VariablePointerAnalysisAlogorithm(this);
        callGraphVPA.loadCallGraph(entryPoints);
        return callGraphVPA;
    }
    /**
     * 对每个method方法体内部进行类型推导，将变量类型填入
     */
    inferTypes() {
        const typeInference = new TypeInference(this);
        for (let arkFile of this.arkFiles) {
            for (let arkClass of arkFile.getClasses()) {
                for (let arkMethod of arkClass.getMethods()) {
                    typeInference.inferTypeInMethod(arkMethod);
                }
            }
        }
        // get class hierarchy
        this.genExtendedClasses();
    }
    inferSimpleTypes() {
        const typeInference = new TypeInference(this);
        for (let arkFile of this.arkFiles) {
            for (let arkClass of arkFile.getClasses()) {
                for (let arkMethod of arkClass.getMethods()) {
                    typeInference.inferSimpleTypeInMethod(arkMethod);
                }
            }
        }
    }
    collectProjectImportInfos() {
        this.arkFiles.forEach((arkFile) => {
            arkFile.getImportInfos().forEach((importInfo) => {
                this.globalImportInfos.push(importInfo);
            });
        });
    }
    genExtendedClasses() {
        let allClasses = this.getAllClassesUnderTargetProject();
        allClasses.forEach((cls) => {
            let superClassName = cls.getSuperClassName();
            let superClass = null;
            superClass = ModelUtils.getClassWithNameFromClass(superClassName, cls);
            if (superClass != null) {
                cls.setSuperClass(superClass);
                superClass.addExtendedClass(cls);
            }
        });
    }
    findOriginPathFromTransformedPath(tsPath) {
        let relativePath = path.relative(this.realProjectDir, tsPath);
        let relativePathWithoutExt = relativePath.replace(/\.ts$/, '');
        let resPath = '';
        if (fs__default.existsSync(tsPath + '.map')) {
            resPath = path.join(this.realProjectOriginDir, relativePathWithoutExt) + '.ets';
        }
        else {
            resPath = path.join(this.realProjectOriginDir, relativePath);
        }
        return transfer2UnixPath(resPath);
    }
    getClassMap() {
        var _a, _b;
        const classMap = new Map();
        for (const file of this.arkFiles) {
            const fileClass = [];
            const namespaceStack = [];
            const parentMap = new Map();
            const finalNamespaces = [];
            for (const arkClass of file.getClasses()) {
                fileClass.push(arkClass);
            }
            for (const ns of file.getNamespaces()) {
                namespaceStack.push(ns);
                parentMap.set(ns, file);
            }
            classMap.set(file.getFileSignature(), fileClass);
            // 第一轮遍历，加上每个namespace自己的class
            while (namespaceStack.length > 0) {
                const ns = namespaceStack.shift();
                const nsClass = [];
                for (const arkClass of ns.getClasses()) {
                    nsClass.push(arkClass);
                }
                classMap.set(ns.getNamespaceSignature(), nsClass);
                if (ns.getNamespaces().length == 0) {
                    finalNamespaces.push(ns);
                }
                else {
                    for (const nsns of ns.getNamespaces()) {
                        namespaceStack.push(nsns);
                        parentMap.set(nsns, ns);
                    }
                }
            }
            // 第二轮遍历，父节点加上子节点的export的class
            while (finalNamespaces.length > 0) {
                const finalNS = finalNamespaces.shift();
                const exportClass = [];
                for (const arkClass of finalNS.getClasses()) {
                    if (arkClass.isExported()) {
                        exportClass.push(arkClass);
                    }
                }
                let p = finalNS;
                while (p.isExported()) {
                    const parent = parentMap.get(p);
                    if (parent instanceof ArkNamespace) {
                        (_a = classMap.get(parent.getNamespaceSignature())) === null || _a === void 0 ? void 0 : _a.push(...exportClass);
                        p = parent;
                    }
                    else if (parent instanceof ArkFile) {
                        (_b = classMap.get(parent.getFileSignature())) === null || _b === void 0 ? void 0 : _b.push(...exportClass);
                        break;
                    }
                }
                const parent = parentMap.get(finalNS);
                if (parent instanceof ArkNamespace && !finalNamespaces.includes(parent)) {
                    finalNamespaces.push(parent);
                }
            }
        }
        for (const file of this.arkFiles) {
            // 文件加上import的class，包括ns的
            const importClasses = [];
            const importNameSpaces = [];
            for (const importInfo of file.getImportInfos()) {
                const importClass = ModelUtils.getClassInImportInfoWithName(importInfo.getImportClauseName(), file);
                if (importClass && !importClasses.includes(importClass)) {
                    importClasses.push(importClass);
                }
                const importNameSpace = ModelUtils.getNamespaceInImportInfoWithName(importInfo.getImportClauseName(), file);
                if (importNameSpace && !importNameSpaces.includes(importNameSpace)) {
                    const importNameSpaceClasses = classMap.get(importNameSpace.getNamespaceSignature());
                    importClasses.push(...importNameSpaceClasses.filter(c => !importClasses.includes(c) && c.getName() != '_DEFAULT_ARK_CLASS'));
                }
            }
            const fileClasses = classMap.get(file.getFileSignature());
            fileClasses.push(...importClasses.filter(c => !fileClasses.includes(c)));
            // 子节点加上父节点的class
            const namespaceStack = [...file.getNamespaces()];
            for (const ns of namespaceStack) {
                const nsClasses = classMap.get(ns.getNamespaceSignature());
                nsClasses.push(...fileClasses.filter(c => !nsClasses.includes(c) && c.getName() != '_DEFAULT_ARK_CLASS'));
            }
            while (namespaceStack.length > 0) {
                const ns = namespaceStack.shift();
                const nsClasses = classMap.get(ns.getNamespaceSignature());
                for (const nsns of ns.getNamespaces()) {
                    const nsnsClasses = classMap.get(nsns.getNamespaceSignature());
                    nsnsClasses.push(...nsClasses.filter(c => !nsnsClasses.includes(c) && c.getName() != '_DEFAULT_ARK_CLASS'));
                    namespaceStack.push(nsns);
                }
            }
        }
        return classMap;
    }
}

var ValueTag;
(function (ValueTag) {
    ValueTag[ValueTag["TAINT"] = 0] = "TAINT";
})(ValueTag || (ValueTag = {}));

class DominanceFinder {
    constructor(cfg) {
        this.blocks = [];
        this.blockToIdx = new Map;
        this.idoms = [];
        this.domFrontiers = [];
        this.blocks = Array.from(cfg.getBlocks());
        for (let i = 0; i < this.blocks.length; i++) {
            let block = this.blocks[i];
            this.blockToIdx.set(block, i);
        }
        const startingBlock = cfg.getStartingBlock();
        // calculate immediate dominator for each block
        this.idoms = new Array(this.blocks.length);
        this.idoms[0] = 0;
        for (let i = 1; i < this.idoms.length; i++) {
            this.idoms[i] = -1;
        }
        let isChanged = true;
        while (isChanged) {
            isChanged = false;
            for (const block of this.blocks) {
                if (block == startingBlock) {
                    continue;
                }
                let blockIdx = this.blockToIdx.get(block);
                let preds = Array.from(block.getPredecessors());
                let newIdom = this.getFirstDefinedBlockPredIdx(preds);
                if (preds.length > 0 && newIdom != -1) {
                    for (const pred of preds) {
                        let predIdx = this.blockToIdx.get(pred);
                        if (this.idoms[predIdx] != -1) {
                            newIdom = this.intersect(newIdom, predIdx);
                        }
                    }
                    if (this.idoms[blockIdx] != newIdom) {
                        this.idoms[blockIdx] = newIdom;
                        isChanged = true;
                    }
                }
            }
        }
        // calculate dominance frontiers for each block
        this.domFrontiers = new Array(this.blocks.length);
        for (let i = 0; i < this.domFrontiers.length; i++) {
            this.domFrontiers[i] = new Array();
        }
        for (const block of this.blocks) {
            let preds = Array.from(block.getPredecessors());
            if (preds.length > 1) {
                let blockIdx = this.blockToIdx.get(block);
                for (const pred of preds) {
                    let predIdx = this.blockToIdx.get(pred);
                    while (predIdx != this.idoms[blockIdx]) {
                        this.domFrontiers[predIdx].push(blockIdx);
                        predIdx = this.idoms[predIdx];
                    }
                }
            }
        }
    }
    getDominanceFrontiers(block) {
        if (!this.blockToIdx.has(block)) {
            throw new Error("The given block: " + block + " is not in Cfg!");
        }
        let idx = this.blockToIdx.get(block);
        let dfs = new Set();
        let dfsIdx = this.domFrontiers[idx];
        for (const dfIdx of dfsIdx) {
            dfs.add(this.blocks[dfIdx]);
        }
        return dfs;
    }
    getBlocks() {
        return this.blocks;
    }
    getBlockToIdx() {
        return this.blockToIdx;
    }
    getImmediateDominators() {
        return this.idoms;
    }
    getFirstDefinedBlockPredIdx(preds) {
        for (const block of preds) {
            let idx = this.blockToIdx.get(block);
            if (this.idoms[idx] != -1) {
                return idx;
            }
        }
        return -1;
    }
    intersect(a, b) {
        while (a != b) {
            if (a > b) {
                a = this.idoms[a];
            }
            else {
                b = this.idoms[b];
            }
        }
        return a;
    }
}

class DominanceTree {
    constructor(dominanceFinder) {
        this.blocks = [];
        this.blockToIdx = new Map();
        this.children = [];
        this.parents = [];
        this.blocks = dominanceFinder.getBlocks();
        this.blockToIdx = dominanceFinder.getBlockToIdx();
        let idoms = dominanceFinder.getImmediateDominators();
        // build the tree
        let treeSize = this.blocks.length;
        this.children = new Array(treeSize);
        this.parents = new Array(treeSize);
        for (let i = 0; i < treeSize; i++) {
            this.children[i] = new Array();
            this.parents[i] = -1;
        }
        for (let i = 0; i < treeSize; i++) {
            if (idoms[i] != i) {
                this.parents[i] = idoms[i];
                this.children[idoms[i]].push(i);
            }
        }
    }
    getAllNodesDFS() {
        let dfsBlocks = new Array();
        let queue = new Array();
        queue.push(this.getRoot());
        while (queue.length != 0) {
            let curr = queue.splice(0, 1)[0];
            dfsBlocks.push(curr);
            let childList = this.getChildren(curr);
            if (childList.length != 0) {
                for (let i = childList.length - 1; i >= 0; i--) {
                    queue.splice(0, 0, childList[i]);
                }
            }
        }
        return dfsBlocks;
    }
    getChildren(block) {
        let childList = new Array();
        let idx = this.blockToIdx.get(block);
        for (const i of this.children[idx]) {
            childList.push(this.blocks[i]);
        }
        return childList;
    }
    getRoot() {
        return this.blocks[0];
    }
}

class ValueUtil {
    static getDefaultInstance(type) {
        switch (type) {
            case StringType.getInstance():
                return this.getStringTypeDefaultValue();
            case NumberType.getInstance():
                return this.getNumberTypeDefaultValue();
            case UndefinedType.getInstance():
                return this.getUndefinedTypeDefaultValue();
            default:
                return new Constant('null', NullType.getInstance());
        }
    }
    static getStringTypeDefaultValue() {
        return this.StringTypeDefaultInstance;
    }
    static getNumberTypeDefaultValue() {
        return this.NumberTypeDefaultInstance;
    }
    static getUndefinedTypeDefaultValue() {
        return this.UndefinedTypeDefaultInstance;
    }
}
ValueUtil.StringTypeDefaultInstance = new Constant('', StringType.getInstance());
ValueUtil.NumberTypeDefaultInstance = new Constant('0', NumberType.getInstance());
ValueUtil.UndefinedTypeDefaultInstance = new Constant('undefined', UndefinedType.getInstance());

class Edge {
    static getKind(srcStmt, tgtStmt) {
        return 0;
    }
}
class PathEdgePoint {
    constructor(node, fact) {
        this.node = node;
        this.fact = fact;
    }
}
class PathEdge {
    constructor(start, end) {
        this.edgeStart = start;
        this.edgeEnd = end;
    }
}

class DataflowProblem {
    transferEdge(srcStmt, tgtStmt) {
        Edge.getKind(srcStmt, tgtStmt);
    }
}

class DataflowResult {
}

class DataflowSolver {
    constructor(problem, scene) {
        this.problem = problem;
        this.scene = scene;
        scene.inferTypes();
        this.zeroFact = problem.createZeroValue();
        this.workList = new Array();
        this.pathEdgeSet = new Set();
        this.inComing = new Map();
        this.endSummary = new Map();
        this.summaryEdge = new Set();
        this.stmtNexts = new Map();
    }
    solve() {
        this.init();
        this.doSolve();
    }
    computeResult(stmt, d) {
        for (let pathEdge of this.pathEdgeSet) {
            if (pathEdge.edgeEnd.node == stmt && pathEdge.edgeEnd.fact == d) {
                return true;
            }
        }
        return false;
    }
    getChildren(stmt) {
        return Array.from(this.stmtNexts.get(stmt) || []);
    }
    init() {
        let edgePoint = new PathEdgePoint(this.problem.getEntryPoint(), this.zeroFact);
        let edge = new PathEdge(edgePoint, edgePoint);
        this.workList.push(edge);
        this.pathEdgeSet.add(edge);
        // build CHA
        this.CHA = this.scene.makeCallGraphCHA([this.problem.getEntryMethod().getSignature()]);
        this.buildStmtMap();
        return;
    }
    buildStmtMapInClass(clas) {
        for (const method of clas.getMethods()) {
            for (const block of method.getCfg().getBlocks()) {
                const stmts = block.getStmts();
                for (let stmtIndex = 0; stmtIndex < stmts.length; stmtIndex++) {
                    const stmt = stmts[stmtIndex];
                    if (stmtIndex != stmts.length - 1) {
                        this.stmtNexts.set(stmt, new Set([stmts[stmtIndex + 1]]));
                    }
                    else {
                        const set = new Set();
                        for (const successor of block.getSuccessors()) {
                            set.add(successor.getStmts()[0]);
                        }
                        this.stmtNexts.set(stmt, set);
                    }
                }
            }
        }
    }
    buildStmtMap() {
        for (const file of this.scene.getFiles()) {
            for (const ns of file.getNamespaces()) {
                for (const clas of ns.getClasses()) {
                    this.buildStmtMapInClass(clas);
                }
            }
            for (const clas of file.getClasses()) {
                this.buildStmtMapInClass(clas);
            }
        }
    }
    getAllCalleeMethods(callNode) {
        const methodSignatures = this.CHA.resolveCall(this.problem.getEntryMethod().getSignature(), callNode);
        const methods = new Set();
        for (const methodSignature of methodSignatures) {
            const method = ModelUtils.getMethodWithMethodSignature(methodSignature, this.scene);
            if (method) {
                methods.add(method);
            }
        }
        return methods;
    }
    getReturnSiteOfCall(call) {
        return [...this.stmtNexts.get(call)][0];
    }
    getStartOfCallerMethod(call) {
        const cfg = call.getCfg();
        const paraNum = cfg.getDeclaringMethod().getParameters().length;
        return [...cfg.getBlocks()][0].getStmts()[paraNum];
    }
    pathEdgeSetHasEdge(edge) {
        for (const path of this.pathEdgeSet) {
            if (path.edgeEnd.node == edge.edgeEnd.node && factEqual(path.edgeEnd.fact, edge.edgeEnd.fact) &&
                path.edgeStart.node == edge.edgeStart.node && factEqual(path.edgeStart.fact, edge.edgeStart.fact)) {
                return true;
            }
        }
        return false;
    }
    propagate(edge) {
        if (!this.pathEdgeSetHasEdge(edge)) {
            this.workList.push(edge);
            this.pathEdgeSet.add(edge);
        }
    }
    processExitNode(edge) {
        var _a;
        let startEdgePoint = edge.edgeStart;
        let exitEdgePoint = edge.edgeEnd;
        const summary = this.endSummary.get(startEdgePoint);
        if (summary == undefined) {
            this.endSummary.set(startEdgePoint, new Set([exitEdgePoint]));
        }
        else {
            summary.add(exitEdgePoint);
        }
        const callEdgePoints = this.inComing.get(startEdgePoint);
        if (callEdgePoints == undefined) {
            if (startEdgePoint.node.getCfg().getDeclaringMethod() == this.problem.getEntryMethod()) {
                return;
            }
            throw new Error("incoming does not have " + ((_a = startEdgePoint.node.getCfg()) === null || _a === void 0 ? void 0 : _a.getDeclaringMethod().toString()));
        }
        for (let callEdgePoint of callEdgePoints) {
            let returnSite = this.getReturnSiteOfCall(callEdgePoint.node);
            let returnFlowFunc = this.problem.getExitToReturnFlowFunction(exitEdgePoint.node, returnSite, callEdgePoint.node);
            for (let fact of returnFlowFunc.getDataFacts(exitEdgePoint.fact)) {
                let returnSitePoint = new PathEdgePoint(returnSite, fact);
                let cacheEdge = new PathEdge(callEdgePoint, returnSitePoint);
                let summaryEdgeHasCacheEdge = false;
                for (const sEdge of this.summaryEdge) {
                    if (sEdge.edgeStart == callEdgePoint && sEdge.edgeEnd.node == returnSite && sEdge.edgeEnd.fact == fact) {
                        summaryEdgeHasCacheEdge = true;
                        break;
                    }
                }
                if (!summaryEdgeHasCacheEdge) {
                    this.summaryEdge.add(cacheEdge);
                    let startOfCaller = this.getStartOfCallerMethod(callEdgePoint.node);
                    for (let pathEdge of this.pathEdgeSet) {
                        if (pathEdge.edgeStart.node == startOfCaller && pathEdge.edgeEnd == callEdgePoint) {
                            this.propagate(new PathEdge(pathEdge.edgeStart, returnSitePoint));
                        }
                    }
                }
            }
        }
    }
    processNormalNode(edge) {
        let start = edge.edgeStart;
        let end = edge.edgeEnd;
        let stmts = this.getChildren(end.node);
        for (let stmt of stmts) {
            let flowFunction = this.problem.getNormalFlowFunction(end.node, stmt);
            let set = flowFunction.getDataFacts(end.fact);
            for (let fact of set) {
                let edgePoint = new PathEdgePoint(stmt, fact);
                this.propagate(new PathEdge(start, edgePoint));
            }
        }
    }
    processCallNode(edge) {
        let start = edge.edgeStart;
        let callEdgePoint = edge.edgeEnd;
        let callees = this.getAllCalleeMethods(callEdgePoint.node);
        let callNode = edge.edgeEnd.node;
        let returnSite = this.getReturnSiteOfCall(callEdgePoint.node);
        for (let callee of callees) {
            let callFlowFunc = this.problem.getCallFlowFunction(callNode, callee);
            let firstStmt = [...callee.getCfg().getBlocks()][0].getStmts()[callee.getParameters().length];
            let facts = callFlowFunc.getDataFacts(callEdgePoint.fact);
            for (let fact of facts) {
                // method start loop path edge
                let startEdgePoint = new PathEdgePoint(firstStmt, fact);
                this.propagate(new PathEdge(startEdgePoint, startEdgePoint));
                //add callEdgePoint in inComing.get(startEdgePoint)
                let coming = undefined;
                for (const incoming of this.inComing.keys()) {
                    if (incoming.fact == startEdgePoint.fact && incoming.node == startEdgePoint.node) {
                        coming = this.inComing.get(incoming);
                        break;
                    }
                }
                if (coming == undefined) {
                    this.inComing.set(startEdgePoint, new Set([callEdgePoint]));
                }
                else {
                    coming.add(callEdgePoint);
                }
                let exitEdgePoints = new Set();
                for (const end of Array.from(this.endSummary.keys())) {
                    if (end.fact == fact && end.node == firstStmt) {
                        exitEdgePoints = this.endSummary.get(end);
                    }
                }
                for (let exitEdgePoint of exitEdgePoints) {
                    let returnFlowFunc = this.problem.getExitToReturnFlowFunction(exitEdgePoint.node, returnSite, callEdgePoint.node);
                    for (let returnFact of returnFlowFunc.getDataFacts(exitEdgePoint.fact)) {
                        this.summaryEdge.add(new PathEdge(edge.edgeEnd, new PathEdgePoint(returnSite, returnFact)));
                    }
                }
            }
        }
        let callToReturnflowFunc = this.problem.getCallToReturnFlowFunction(edge.edgeEnd.node, returnSite);
        let set = callToReturnflowFunc.getDataFacts(callEdgePoint.fact);
        for (let fact of set) {
            this.propagate(new PathEdge(start, new PathEdgePoint(returnSite, fact)));
        }
        for (let cacheEdge of this.summaryEdge) {
            if (cacheEdge.edgeStart == edge.edgeEnd && cacheEdge.edgeEnd.node == returnSite) {
                this.propagate(new PathEdge(start, cacheEdge.edgeEnd)); //什么时候执行
            }
        }
    }
    doSolve() {
        while (this.workList.length != 0) {
            let pathEdge = this.workList.shift();
            let targetStmt = pathEdge.edgeEnd.node;
            if (this.isCallStatement(targetStmt)) {
                this.processCallNode(pathEdge);
            }
            else if (this.isExitStatement(targetStmt)) {
                this.processExitNode(pathEdge);
            }
            else {
                this.processNormalNode(pathEdge);
            }
        }
    }
    isCallStatement(stmt) {
        return stmt.containsInvokeExpr();
    }
    isExitStatement(stmt) {
        return stmt instanceof ArkReturnStmt || stmt instanceof ArkReturnVoidStmt;
    }
    getPathEdgeSet() {
        return this.pathEdgeSet;
    }
}
function factEqual(fact1, fact2) {
    if (fact1 instanceof ArkInstanceFieldRef && fact2 instanceof ArkInstanceFieldRef) {
        return fact1.getFieldSignature().getFieldName() == fact2.getFieldSignature().getFieldName() && fact1.getBase().getName() == fact2.getBase().getName();
    }
    else if (fact1 instanceof ArkStaticFieldRef && fact2 instanceof ArkStaticFieldRef) {
        return fact1.getFieldSignature() == fact2.getFieldSignature();
    }
    return fact1 == fact2;
}

class Fact {
}

class UndefinedVariableChecker extends DataflowProblem {
    constructor(stmt, method) {
        super();
        this.zeroValue = new Constant('undefined', UndefinedType.getInstance());
        this.entryPoint = stmt;
        this.entryMethod = method;
        this.scene = method.getDeclaringArkFile().getScene();
        this.classMap = this.scene.getClassMap();
    }
    getEntryPoint() {
        return this.entryPoint;
    }
    getEntryMethod() {
        return this.entryMethod;
    }
    isUndefined(val) {
        if (val instanceof Constant) {
            let constant = val;
            if (constant.getType() instanceof UndefinedType) {
                return true;
            }
        }
        return false;
    }
    getNormalFlowFunction(srcStmt, tgtStmt) {
        let checkerInstance = this;
        return new class {
            getDataFacts(dataFact) {
                let ret = new Set();
                if (checkerInstance.getEntryPoint() == srcStmt && checkerInstance.getZeroValue() == dataFact) {
                    let entryMethod = checkerInstance.getEntryMethod();
                    entryMethod.getBody();
                    const parameters = [...entryMethod.getCfg().getBlocks()][0].getStmts().slice(0, entryMethod.getParameters().length);
                    for (let i = 0; i < parameters.length; i++) {
                        const para = parameters[i].getDef();
                        if (para)
                            ret.add(para);
                    }
                    ret.add(checkerInstance.getZeroValue());
                    // 加入所有的全局变量和静态属性（may analysis）
                    const staticFields = entryMethod.getDeclaringArkClass().getStaticFields(checkerInstance.classMap);
                    for (const field of staticFields) {
                        if (field.getInitializer() == undefined) {
                            ret.add(new ArkStaticFieldRef(field.getSignature()));
                        }
                    }
                    // const file = entryMethod.getDeclaringArkFile();
                    // const classes = file.getClasses();
                    // for (const importInfo of file.getImportInfos()){
                    //     const importClass = ModelUtils.getClassWithName(importInfo.getImportClauseName(), entryMethod);
                    //     if (importClass && !classes.includes(importClass)) {
                    //         classes.push(importClass);
                    //     }
                    // }
                    // const nameSpaces = file.getNamespaces();
                    // for (const importInfo of file.getImportInfos()){
                    //     const importNameSpace = ModelUtils.getClassWithName(importInfo.getImportClauseName(), entryMethod);
                    //     if (importNameSpace && !classes.includes(importNameSpace)) {
                    //         classes.push(importNameSpace);
                    //     }
                    // }
                    // while (nameSpaces.length > 0) {
                    //     const nameSpace = nameSpaces.pop()!;
                    //     for (const exportInfo of nameSpace.getExportInfos()) {
                    //         const clas = ModelUtils.getClassInNamespaceWithName(exportInfo.getExportClauseName(), nameSpace);
                    //         if (clas && !classes.includes(clas)) {
                    //             classes.push(clas);
                    //             continue;
                    //         }
                    //         const ns = ModelUtils.getNamespaceInNamespaceWithName(exportInfo.getExportClauseName(), nameSpace);
                    //         if (ns && !nameSpaces.includes(ns)) {
                    //             nameSpaces.push(ns);
                    //         }
                    //     }
                    // }
                    // for (const arkClass of classes) {
                    //     for (const field of arkClass.getFields()) {
                    //         if (field.isStatic() && field.getInitializer() == undefined) {
                    //             ret.add(new ArkStaticFieldRef(field.getSignature()));
                    //         }
                    //     }
                    // }
                    return ret;
                }
                if (!factEqual(srcStmt.getDef(), dataFact)) {
                    ret.add(dataFact);
                }
                if (srcStmt instanceof ArkAssignStmt) {
                    let ass = srcStmt;
                    let assigned = ass.getLeftOp();
                    let rightOp = ass.getRightOp();
                    if (checkerInstance.getZeroValue() == dataFact) {
                        if (checkerInstance.isUndefined(rightOp)) {
                            ret.add(assigned);
                        }
                    }
                    else if (factEqual(rightOp, dataFact) || rightOp.getType() instanceof UndefinedType) {
                        ret.add(assigned);
                    }
                    else if (rightOp instanceof ArkInstanceFieldRef) {
                        const base = rightOp.getBase();
                        if (base == dataFact) {
                            console.log("undefined base");
                            console.log(srcStmt.toString());
                            console.log(srcStmt.getOriginPositionInfo());
                        }
                    }
                    else if (dataFact instanceof ArkInstanceFieldRef && rightOp == dataFact.getBase()) {
                        const field = new ArkInstanceFieldRef(srcStmt.getLeftOp(), dataFact.getFieldSignature());
                        ret.add(field);
                    }
                }
                return ret;
            }
        };
    }
    getCallFlowFunction(srcStmt, method) {
        let checkerInstance = this;
        return new class {
            getDataFacts(dataFact) {
                const ret = new Set();
                if (checkerInstance.getZeroValue() == dataFact) {
                    ret.add(checkerInstance.getZeroValue());
                    // 加上调用函数能访问到的所有静态变量，如果不考虑多线程，加上所有变量，考虑则要统计之前已经处理过的变量并排除
                    for (const field of method.getDeclaringArkClass().getStaticFields(checkerInstance.classMap)) {
                        if (field.getInitializer() == undefined) {
                            ret.add(new ArkStaticFieldRef(field.getSignature()));
                        }
                    }
                }
                else {
                    const callExpr = srcStmt.getExprs()[0];
                    if (callExpr instanceof ArkInstanceInvokeExpr && dataFact instanceof ArkInstanceFieldRef && callExpr.getBase().getName() == dataFact.getBase().getName()) {
                        // todo:base转this
                        const baseType = callExpr.getBase().getType();
                        const arkClass = checkerInstance.scene.getClass(baseType.getClassSignature());
                        const constructor = ModelUtils.getMethodInClassWithName("constructor", arkClass);
                        const block = [...constructor.getCfg().getBlocks()][0];
                        for (const stmt of block.getStmts()) {
                            const def = stmt.getDef();
                            if (def && def instanceof ArkInstanceFieldRef && def.getBase().getName() == "this" && def.getFieldName() == dataFact.getFieldName()) {
                                ret.add(def);
                                break;
                            }
                        }
                    }
                    else if (callExpr instanceof ArkStaticInvokeExpr && dataFact instanceof ArkStaticFieldRef && callExpr.getMethodSignature().getDeclaringClassSignature() == dataFact.getFieldSignature().getDeclaringClassSignature()) {
                        ret.add(dataFact);
                    }
                }
                const callStmt = srcStmt;
                const args = callStmt.getInvokeExpr().getArgs();
                for (let i = 0; i < args.length; i++) {
                    if (args[i] == dataFact || checkerInstance.isUndefined(args[i]) && checkerInstance.getZeroValue() == dataFact) {
                        const realParameter = [...method.getCfg().getBlocks()][0].getStmts()[i].getDef();
                        if (realParameter)
                            ret.add(realParameter);
                    }
                    else if (dataFact instanceof ArkInstanceFieldRef && dataFact.getBase().getName() == args[i].toString()) {
                        const realParameter = [...method.getCfg().getBlocks()][0].getStmts()[i].getDef();
                        if (realParameter) {
                            const retRef = new ArkInstanceFieldRef(realParameter, dataFact.getFieldSignature());
                            ret.add(retRef);
                        }
                    }
                }
                return ret;
            }
        };
    }
    getExitToReturnFlowFunction(srcStmt, tgtStmt, callStmt) {
        let checkerInstance = this;
        return new class {
            getDataFacts(dataFact) {
                let ret = new Set();
                if (dataFact == checkerInstance.getZeroValue()) {
                    ret.add(checkerInstance.getZeroValue());
                }
                if (dataFact instanceof ArkInstanceFieldRef && dataFact.getBase().getName() == "this") {
                    // todo:this转base。
                    const expr = callStmt.getExprs()[0];
                    if (expr instanceof ArkInstanceInvokeExpr) {
                        const fieldRef = new ArkInstanceFieldRef(expr.getBase(), dataFact.getFieldSignature());
                        ret.add(fieldRef);
                    }
                }
                if (!(callStmt instanceof ArkAssignStmt)) {
                    return ret;
                }
                if (srcStmt instanceof ArkReturnStmt) {
                    let ass = callStmt;
                    let leftOp = ass.getLeftOp();
                    let retVal = srcStmt.getOp();
                    if (dataFact == checkerInstance.getZeroValue()) {
                        ret.add(checkerInstance.getZeroValue());
                        if (checkerInstance.isUndefined(retVal)) {
                            ret.add(leftOp);
                        }
                    }
                    else if (retVal == dataFact) {
                        ret.add(leftOp);
                    }
                }
                return ret;
            }
        };
    }
    getCallToReturnFlowFunction(srcStmt, tgtStmt) {
        let checkerInstance = this;
        return new class {
            getDataFacts(dataFact) {
                const ret = new Set();
                if (checkerInstance.getZeroValue() == dataFact) {
                    ret.add(checkerInstance.getZeroValue());
                }
                const defValue = srcStmt.getDef();
                if (!(defValue && defValue == dataFact)) {
                    ret.add(dataFact);
                }
                return ret;
            }
        };
    }
    createZeroValue() {
        return this.zeroValue;
    }
    getZeroValue() {
        return this.zeroValue;
    }
}
class UndefinedVariableSolver extends DataflowSolver {
    constructor(problem, scene) {
        super(problem, scene);
    }
}

const logger = ConsoleLogger.getLogger();
/**
 * 从指定目录中提取指定后缀名的所有文件
 * @param srcPath string 要提取文件的项目入口，相对或绝对路径都可
 * @param exts string[] 要提取的文件扩展名数组，每个扩展名需以点开头
 * @param filenameArr string[] 用来存放提取出的文件的原始路径的数组，可不传，默认为空数组
 * @return string[] 提取出的文件的原始路径数组
 */
function getAllFiles(srcPath, exts, filenameArr = []) {
    // 如果源目录不存在，直接结束程序
    if (!fs__default.existsSync(srcPath)) {
        logger.error(`Input directory is not exist, please check!`);
        return filenameArr;
    }
    // 获取src的绝对路径
    const realSrc = fs__default.realpathSync(srcPath);
    // 遍历src，判断文件类型
    fs__default.readdirSync(realSrc).forEach(filename => {
        // 拼接文件的绝对路径
        const realFile = path.resolve(realSrc, filename);
        //TODO: 增加排除文件后缀和目录
        // 如果是目录，递归提取
        if (fs__default.statSync(realFile).isDirectory()) {
            getAllFiles(realFile, exts, filenameArr);
        }
        else {
            // 如果是文件，则判断其扩展名是否在给定的扩展名数组中
            if (exts.includes(path.extname(filename))) {
                filenameArr.push(realFile);
            }
        }
    });
    return filenameArr;
}

function isPrimaryType(type) {
    switch (type) {
        case "boolean":
        case "number":
        case "string":
        case "String":
        case "void":
        case "any":
        case "null":
        case "undefined":
            return true;
        default:
            return false;
    }
}
function isPrimaryTypeKeyword(keyword) {
    switch (keyword) {
        case "NumberKeyword":
        case "StringKeyword":
        case "String":
        case "NullKeyword":
        case "BooleanKeyword":
            return true;
        default:
            return false;
    }
}
function resolvePrimaryTypeKeyword(keyword) {
    switch (keyword) {
        case "NumberKeyword":
            return "number";
        case "StringKeyword":
            return "string";
        case "NullKeyword":
            return "null";
        case "String":
            return "String";
        case "BooleanKeyword":
            return "boolean";
        default:
            return "";
    }
}
function splitType(typeName, separator) {
    return typeName.split(separator).map(type => type.trim()).filter(Boolean);
}
function transformArrayToString(array, separator = '|') {
    return array.join(separator);
}
function buildTypeReferenceString(astNodes) {
    return astNodes.map(node => {
        if (node.kind === 'Identifier') {
            return node.text;
        }
        else if (node.kind === 'DotToken') {
            return '.';
        }
        return '';
    }).join('');
}
function resolveBinaryResultType(op1Type, op2Type, operator) {
    switch (operator) {
        case "+":
            if (op1Type instanceof StringType || op2Type instanceof StringType) {
                return StringType.getInstance();
            }
            if (op1Type instanceof NumberType && op2Type instanceof NumberType) {
                return NumberType.getInstance();
            }
            break;
        case "-":
        case "*":
        case "/":
        case "%":
            if (op1Type instanceof NumberType && op2Type instanceof NumberType) {
                return NumberType.getInstance();
            }
            break;
        case "<":
        case "<=":
        case ">":
        case ">=":
        case "==":
        case "!=":
        case "===":
        case "!==":
        case "&&":
        case "||":
            return BooleanType.getInstance();
        case "&":
        case "|":
        case "^":
        case "<<":
        case ">>":
        case ">>>":
            if (op1Type instanceof NumberType && op2Type instanceof NumberType) {
                return NumberType.getInstance();
            }
            break;
    }
    return null;
}
function getArkFileByName(fileName, scene) {
    for (let sceneFile of scene.arkFiles) {
        if (sceneFile.getName() === fileName) {
            return sceneFile;
        }
    }
    return null;
}
function resolveClassInstance(classCompleteName, file) {
    if (file == null)
        return null;
    let lastDotIndex = classCompleteName.lastIndexOf('.');
    let classRealName = classCompleteName.substring(lastDotIndex + 1);
    for (let arkClass of file.getClasses()) {
        if (arkClass.getName() === classRealName) {
            return arkClass;
        }
    }
    return null;
}
function resolveNameSpace(nameSpaceNameArray, file) {
    if (file == null)
        return null;
    let nameSpaceInstance = null;
    for (let i = 0; i < nameSpaceNameArray.length - 1; i++) {
        let nameSpaceName = nameSpaceNameArray[i];
        let nameSpaceSignature = searchImportMessage(file, nameSpaceName, matchNameSpaceInFile);
        // TODO: ArkNameSpace.getName()是全局唯一吗? 有没有全局找ArkNameSpace的实例的方法?
        if (nameSpaceInstance === null) {
            let nameSpaceList = file.getScene().getAllNamespacesUnderTargetProject();
            for (let nameSpace of nameSpaceList) {
                if (nameSpace.getNamespaceSignature().toString() === nameSpaceSignature) {
                    nameSpaceInstance = nameSpace;
                }
            }
        }
        else {
            let subNameSpace = nameSpaceInstance.getNamespaces();
            let checkNameSpace = false;
            for (let nameSpace of subNameSpace) {
                if (nameSpaceName === nameSpace.getName()) {
                    nameSpaceInstance = nameSpace;
                    checkNameSpace = true;
                    break;
                }
            }
            if (!checkNameSpace) {
                return null;
            }
        }
    }
    return nameSpaceInstance;
}
function resolveClassInstanceField(fieldName, file) {
    if (file == null)
        return null;
    for (let i = 0; i < fieldName.length - 1; i++) {
        let className = fieldName[i];
        let classInstanceName = searchImportMessage(file, className, matchClassInFile);
        let lastDotIndex = classInstanceName.lastIndexOf('.');
        let classInstanceArkFile = getArkFileByName(classInstanceName.substring(0, lastDotIndex), file.getScene());
        let classInstance = resolveClassInstance(classInstanceName, classInstanceArkFile);
        if (classInstance == null) {
            return null;
        }
        for (let field of classInstance.getFields()) {
            if (field.getName() === fieldName[i + 1]) {
                fieldName[i + 1] = field.getType().toString();
                file = classInstance.getDeclaringArkFile();
                break;
            }
        }
    }
    return searchImportMessage(file, fieldName[fieldName.length - 1], matchClassInFile);
}
function searchImportMessage(file, className, searchCallback) {
    // 调用回调函数作为递归结束条件
    const result = searchCallback(file, className);
    if (result) {
        return result;
    }
    for (let importInfo of file.getImportInfos()) {
        const importFromDir = importInfo.getImportFrom();
        if (className == importInfo.getImportClauseName() && importFromDir != undefined) {
            const fileDir = file.getName().split("\\");
            const importDir = importFromDir.split(/[\/\\]/).filter(item => item !== '.');
            let realName = importInfo.getNameBeforeAs() ? importInfo.getNameBeforeAs() : importInfo.getImportClauseName();
            let parentDirNum = 0;
            while (importDir[parentDirNum] == "..") {
                parentDirNum++;
            }
            if (parentDirNum < fileDir.length) {
                let realImportFileName = path.dirname("");
                for (let i = 0; i < fileDir.length - parentDirNum - 1; i++) {
                    realImportFileName = path.join(realImportFileName, fileDir[i]);
                }
                for (let i = parentDirNum; i < importDir.length; i++) {
                    realImportFileName = path.join(realImportFileName, importDir[i]);
                }
                realImportFileName += ".ts";
                const scene = file.getScene();
                if (scene) {
                    for (let sceneFile of scene.arkFiles) {
                        if (sceneFile.getName() == realImportFileName) {
                            return searchImportMessage(sceneFile, realName, searchCallback);
                        }
                    }
                }
            }
        }
    }
    return "";
}
function typeStrToClassSignature(typeStr) {
    const lastDot = typeStr.lastIndexOf('.');
    const classSignature = new ClassSignature();
    const fileSignature = new FileSignature();
    fileSignature.setFileName(typeStr.substring(0, lastDot));
    classSignature.setDeclaringFileSignature(fileSignature);
    const classType = typeStr.replace(/\\\\/g, '.').split('.');
    classSignature.setClassName(classType[classType.length - 1]);
    return classSignature;
}
const matchNameSpaceInFile = (file, nameSpaceName) => {
    for (let nameSpaceInFile of file.getNamespaces()) {
        if (nameSpaceName === nameSpaceInFile.getName()) {
            return nameSpaceInFile.getNamespaceSignature().toString();
        }
    }
    return null;
};
const matchClassInFile = (file, className) => {
    for (let classInFile of file.getClasses()) {
        if (className === classInFile.getName()) {
            return classInFile.getSignature().getDeclaringFileSignature().getFileName() + "." + className;
        }
    }
    return null;
};
const matchFunctionInFile = (file, functionName) => {
    for (let functionOfFile of file.getDefaultClass().getMethods()) {
        if (functionName == functionOfFile.getName()) {
            return functionOfFile.getSignature().toString();
        }
    }
    return null;
};

class StaticSingleAssignmentFormer {
    transformBody(body) {
        var _a;
        let cfg = body.getCfg();
        let blockToDefs = new Map();
        let localToBlocks = new Map();
        for (const block of cfg.getBlocks()) {
            let defs = new Set();
            for (const stmt of block.getStmts()) {
                if (stmt.getDef() != null && stmt.getDef() instanceof Local) {
                    let local = stmt.getDef();
                    defs.add(local);
                    if (localToBlocks.has(local)) {
                        (_a = localToBlocks.get(local)) === null || _a === void 0 ? void 0 : _a.add(block);
                    }
                    else {
                        let blcoks = new Set();
                        blcoks.add(block);
                        localToBlocks.set(local, blcoks);
                    }
                }
            }
            blockToDefs.set(block, defs);
        }
        let dominanceFinder = new DominanceFinder(cfg);
        let blockToPhiStmts = this.decideBlockToPhiStmts(body, dominanceFinder, blockToDefs, localToBlocks);
        this.addPhiStmts(blockToPhiStmts, cfg, blockToDefs);
        let dominanceTree = new DominanceTree(dominanceFinder);
        this.renameLocals(body, dominanceTree, blockToPhiStmts);
    }
    decideBlockToPhiStmts(body, dominanceFinder, blockToDefs, localToBlocks) {
        var _a, _b, _c, _d;
        let blockToPhiStmts = new Map();
        let blockToPhiLocals = new Map();
        let localToPhiBlock = new Map();
        for (const local of body.getLocals()) {
            localToPhiBlock.set(local, new Set());
            let phiBlocks = localToPhiBlock.get(local);
            let blocks = Array.from(localToBlocks.get(local));
            while (blocks.length != 0) {
                let block = blocks.splice(0, 1).at(0);
                let dfs = dominanceFinder.getDominanceFrontiers(block);
                for (const df of dfs) {
                    if (!phiBlocks.has(df)) {
                        phiBlocks.add(df);
                        let phiStmt = this.createEmptyPhiStmt(local);
                        if (blockToPhiStmts.has(df)) {
                            (_a = blockToPhiStmts.get(df)) === null || _a === void 0 ? void 0 : _a.add(phiStmt);
                            (_b = blockToPhiLocals.get(df)) === null || _b === void 0 ? void 0 : _b.add(local);
                        }
                        else {
                            let phiStmts = new Set();
                            phiStmts.add(phiStmt);
                            blockToPhiStmts.set(df, phiStmts);
                            let phiLocals = new Set();
                            phiLocals.add(local);
                            blockToPhiLocals.set(df, phiLocals);
                        }
                        (_c = blockToDefs.get(df)) === null || _c === void 0 ? void 0 : _c.add(local);
                        if (!((_d = blockToDefs.get(df)) === null || _d === void 0 ? void 0 : _d.has(local))) {
                            blocks.push(df);
                        }
                    }
                }
            }
        }
        return blockToPhiStmts;
    }
    addPhiStmts(blockToPhiStmts, cfg, blockToDefs) {
        var _a;
        let phiArgsNum = new Map();
        for (const block of cfg.getBlocks()) {
            let succs = Array.from(block.getSuccessors());
            for (const succ of succs) {
                if (blockToPhiStmts.has(succ)) {
                    for (const phi of blockToPhiStmts.get(succ)) {
                        let local = phi.getDef();
                        if ((_a = blockToDefs.get(block)) === null || _a === void 0 ? void 0 : _a.has(local)) {
                            if (phiArgsNum.has(phi)) {
                                let num = phiArgsNum.get(phi);
                                phiArgsNum.set(phi, num + 1);
                            }
                            else {
                                phiArgsNum.set(phi, 1);
                            }
                        }
                    }
                }
            }
        }
        for (const block of blockToPhiStmts.keys()) {
            let phis = blockToPhiStmts.get(block);
            let phisTocheck = new Set(phis);
            for (const phi of phisTocheck) {
                if (phiArgsNum.get(phi) < 2) {
                    phis.delete(phi);
                }
            }
            for (const phi of phis) {
                cfg.insertBefore(block.getHead(), phi);
            }
        }
    }
    renameLocals(body, dominanceTree, blockToPhiStmts) {
        var _a, _b;
        let newLocals = new Set(body.getLocals());
        let localToNameStack = new Map();
        for (const local of newLocals) {
            localToNameStack.set(local, new Array());
        }
        let blockStack = new Array();
        let visited = new Set();
        let dfsBlocks = dominanceTree.getAllNodesDFS();
        let nextFreeIdx = 0;
        for (const block of dfsBlocks) {
            let newPhiStmts = new Set();
            for (const stmt of block.getStmts()) {
                // rename uses
                let uses = stmt.getUses();
                if (uses.length > 0 && !this.constainsPhiExpr(stmt)) {
                    for (const use of uses) {
                        if (use instanceof Local) {
                            let nameStack = localToNameStack.get(use);
                            let newUse = nameStack[nameStack.length - 1];
                            stmt.replaceUse(use, newUse);
                        }
                    }
                }
                // rename def
                let def = stmt.getDef();
                if (def != null && def instanceof Local) {
                    let newName = def.getName() + '#' + nextFreeIdx;
                    nextFreeIdx++;
                    let newDef = new Local(newName);
                    newDef.setOriginalValue(def);
                    newLocals.add(newDef);
                    (_a = localToNameStack.get(def)) === null || _a === void 0 ? void 0 : _a.push(newDef);
                    stmt.setLeftOp(newDef);
                    if (this.constainsPhiExpr(stmt)) {
                        newPhiStmts.add(stmt);
                    }
                }
            }
            visited.add(block);
            blockStack.push(block);
            if (blockToPhiStmts.has(block)) {
                blockToPhiStmts.set(block, newPhiStmts);
            }
            // rename phiStmts' args
            let succs = Array.from(block.getSuccessors());
            for (const succ of succs) {
                if (blockToPhiStmts.has(succ)) {
                    let phiStmts = blockToPhiStmts.get(succ);
                    for (const phiStmt of phiStmts) {
                        let def = phiStmt.getDef();
                        let oriDef = this.getOriginalLocal(def, new Set(localToNameStack.keys()));
                        let nameStack = localToNameStack.get(oriDef);
                        let arg = nameStack[nameStack.length - 1];
                        this.addNewArgToPhi(phiStmt, arg, block);
                    }
                }
            }
            // if a block's children in dominance tree are visited, remove it
            let top = blockStack[blockStack.length - 1];
            let children = dominanceTree.getChildren(top);
            while (this.containsAllChildren(visited, children)) {
                blockStack.pop();
                for (const stmt of top.getStmts()) {
                    let def = stmt.getDef();
                    if (def != null && def instanceof Local) {
                        let oriDef = this.getOriginalLocal(def, new Set(localToNameStack.keys()));
                        (_b = localToNameStack.get(oriDef)) === null || _b === void 0 ? void 0 : _b.pop();
                    }
                }
                // next block to check
                if (blockStack.length > 0) {
                    top = blockStack[blockStack.length - 1];
                    children = dominanceTree.getChildren(top);
                }
                else {
                    break;
                }
            }
        }
        body.setLocals(newLocals);
    }
    constainsPhiExpr(stmt) {
        if (stmt instanceof ArkAssignStmt && stmt.getUses().length > 0) {
            for (const use of stmt.getUses()) {
                if (use instanceof ArkPhiExpr) {
                    return true;
                }
            }
        }
        return false;
    }
    getOriginalLocal(local, locals) {
        if (locals.has(local)) {
            return local;
        }
        let hashPos = local.getName().indexOf('#');
        let oriName = local.getName().substring(0, hashPos);
        for (const oriLocal of locals) {
            if (oriLocal.getName() == oriName) {
                return oriLocal;
            }
        }
        return null;
    }
    addNewArgToPhi(phiStmt, arg, block) {
        for (let use of phiStmt.getUses()) {
            if (use instanceof ArkPhiExpr) {
                let phiExpr = use;
                let args = phiExpr.getArgs();
                let argToBlock = phiExpr.getArgToBlock();
                args.push(arg);
                argToBlock.set(arg, block);
                phiExpr.setArgs(args);
                phiExpr.setArgToBlock(argToBlock);
                break;
            }
        }
    }
    containsAllChildren(blockSet, children) {
        for (const child of children) {
            if (!blockSet.has(child)) {
                return false;
            }
        }
        return true;
    }
    createEmptyPhiStmt(local) {
        let phiExpr = new ArkPhiExpr();
        return new ArkAssignStmt(local, phiExpr);
    }
}

export { ASTree, AbstractCallGraph, AbstractExpr, AbstractFieldRef, AbstractInvokeExpr, AbstractRef, AliasType, AnnotationNamespaceType, AnnotationType, AnnotationTypeQueryType, AnyType, ArkArrayRef, ArkAssignStmt, ArkBinopExpr, ArkBody, ArkCastExpr, ArkCaughtExceptionRef, ArkClass, ArkConditionExpr, ArkDeleteStmt, ArkField, ArkFile, ArkGotoStmt, ArkIfStmt, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkInstanceOfExpr, ArkInvokeStmt, ArkLengthExpr, ArkMethod, ArkNamespace, ArkNewArrayExpr, ArkNewExpr, ArkNopStmt, ArkParameterRef, ArkPhiExpr, ArkReturnStmt, ArkReturnVoidStmt, ArkStaticFieldRef, ArkStaticInvokeExpr, ArkSwitchStmt, ArkThisRef, ArkThrowStmt, ArkTypeOfExpr, ArkUnopExpr, ArrayBindingPatternParameter, ArrayLiteralExpr, ArrayObjectType, ArrayType, BUILDIN_CONTAINER_COMPONENT, BasicBlock, BodyBuilder, BooleanType, CallableType, Cfg, CfgBuilder, ClassAliasType, ClassHierarchyAnalysisAlgorithm, ClassInfo, ClassSignature, ClassType, Config, Constant, DataflowProblem, DataflowResult, DataflowSolver, DefUseChain$1 as DefUseChain, DominanceFinder, DominanceTree, Edge, ExportInfo, ExprUseReplacer, Fact, FieldSignature, FileSignature, IRUtils, ImportInfo, InterfaceSignature, LOG_LEVEL, LineColPosition, LinePosition, LiteralType, Local, MethodInfo, MethodParameter, MethodSignature, MethodSignatureManager, MethodSubSignature, ModelUtils, NamespaceInfo, NamespaceSignature, NeverType, NodeA, NullType, NumberType, ObjectBindingPatternParameter, ObjectLiteralExpr, PathEdge, PathEdgePoint, Position, PrimitiveType, RapidTypeAnalysisAlgorithm, RefUseReplacer, Scene, SceneConfig, SceneManager, Scope, StaticSingleAssignmentFormer, Stmt, StmtUseReplacer, StringType, TupleType, Type, TypeInference, TypeLiteralType, UnclearReferenceType, UndefinedType, UndefinedVariableChecker, UndefinedVariableSolver, UnionType, UnknownType, ValueTag, ValueUtil, VariablePointerAnalysisAlogorithm, ViewTree, ViewTreeNode, VisibleValue, VoidType, arkMethodNodeKind, buildArkFileFromFile, buildArkMethodFromArkClass, buildArkNamespace, buildClassInfo4ClassNode, buildDefaultArkClassFromArkFile, buildDefaultArkClassFromArkNamespace, buildExportInfo4ExportNode, buildGetAccessor2ArkField, buildHeritageClauses, buildImportInfo4ImportNode, buildIndexSignature2ArkField, buildMethodInfo4MethodNode, buildModifiers, buildNamespaceInfo4NamespaceNode, buildNormalArkClassFromArkFile, buildNormalArkClassFromArkNamespace, buildNormalArkMethodFromAstNode, buildNormalArkMethodFromMethodInfo, buildParameters, buildProperty2ArkField, buildReturnType4Method, buildTypeFromPreStr, buildTypeParameters, buildTypeReferenceString, classSignatureCompare, extractLastBracketContent, factEqual, fieldSignatureCompare, fileSignatureCompare, genSignature4ImportClause, getAllFiles, getArkFileByName, handlePropertyAccessExpression, handleQualifiedName, isItemRegistered, isPrimaryType, isPrimaryTypeKeyword, matchClassInFile, matchFunctionInFile, matchNameSpaceInFile, methodSignatureCompare, methodSubSignatureCompare, notStmtOrExprKind, printCallGraphDetails, resolveBinaryResultType, resolveClassInstance, resolveClassInstanceField, resolveNameSpace, resolvePrimaryTypeKeyword, searchImportMessage, splitStringWithRegex, splitType, transfer2UnixPath, transformArrayToString, typeStrToClassSignature, updateSdkConfigPrefix };
//# sourceMappingURL=bundle.js.map
