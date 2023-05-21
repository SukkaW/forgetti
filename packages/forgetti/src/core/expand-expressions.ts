/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as t from '@babel/types';
import type * as babel from '@babel/core';
import type { ComponentNode, StateContext } from './types';
import { getHookCallType } from './get-hook-call-type';
import { isPathValid } from './checks';

function isStatementValid(path: babel.NodePath): boolean {
  if (path) {
    switch (path.node.type) {
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'ForStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
        return false;
      default:
        return true;
    }
  }
  return false;
}

function isInValidExpression(path: babel.NodePath): boolean {
  let current = path.parentPath;
  let prev = path;
  while (current) {
    if (
      isPathValid(current, t.isConditionalExpression)
      && (
        current.get('consequent').node === prev.node
        || current.get('alternate').node === prev.node
      )
    ) {
      return false;
    }
    if (
      isPathValid(current, t.isLogicalExpression)
      && current.get('right').node === prev.node
    ) {
      return false;
    }
    prev = current;
    current = current.parentPath;
  }
  return true;
}

export function expandExpressions(
  ctx: StateContext,
  path: babel.NodePath<ComponentNode>,
): void {
  if (path.node.type === 'ArrowFunctionExpression' && path.node.body.type !== 'BlockStatement') {
    path.node.body = t.blockStatement(
      [t.returnStatement(path.node.body)],
    );
  }
  path.traverse({
    LogicalExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path
        && statement
        && isStatementValid(statement)
      ) {
        const id = p.scope.generateUidIdentifier('condition');

        let test: t.Expression = id;
        switch (p.node.operator) {
          case '??':
            test = t.binaryExpression('==', id, t.nullLiteral());
            break;
          case '||':
            test = t.unaryExpression('!', id);
            break;
          default:
            break;
        }
        statement.insertBefore([
          t.variableDeclaration('let', [t.variableDeclarator(id, p.node.left)]),
          t.ifStatement(
            test,
            t.expressionStatement(t.assignmentExpression('=', id, p.node.right)),
          ),
        ]);
        p.replaceWith(id);
      }
    },
    ConditionalExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path
        && statement
        && isStatementValid(statement)
      ) {
        const id = p.scope.generateUidIdentifier('condition');
        statement.insertBefore([
          t.variableDeclaration('let', [t.variableDeclarator(id)]),
          t.ifStatement(
            p.node.test,
            t.expressionStatement(t.assignmentExpression('=', id, p.node.consequent)),
            t.expressionStatement(t.assignmentExpression('=', id, p.node.alternate)),
          ),
        ]);
        p.replaceWith(id);
      }
    },
  });
  path.scope.crawl();

  path.traverse({
    AssignmentExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path
        && statement
        && isStatementValid(statement)
        && isInValidExpression(p)
        && !isPathValid(p.parentPath, t.isStatement)
        && !isPathValid(p.parentPath, t.isVariableDeclarator)
      ) {
        const id = p.scope.generateUidIdentifier('hoisted');
        statement.insertBefore(
          t.variableDeclaration(
            'let',
            [t.variableDeclarator(id, p.node)],
          ),
        );
        p.replaceWith(id);
      }
    },
    CallExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path
        && statement
        && !isPathValid(p.parentPath, t.isStatement)
        && !isPathValid(p.parentPath, t.isVariableDeclarator)
      ) {
        const hookType = getHookCallType(ctx, p);
        if (hookType === 'custom' || hookType === 'effect') {
          const id = p.scope.generateUidIdentifier('hoisted');
          statement.insertBefore(
            t.variableDeclaration(
              'let',
              [t.variableDeclarator(id, p.node)],
            ),
          );
          p.replaceWith(id);
        }
      }
    },
  });

  path.scope.crawl();
}
