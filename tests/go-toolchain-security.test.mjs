import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dockerfile = readFileSync(new URL('../api/Dockerfile', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/api.yml', import.meta.url), 'utf8');
const goMod = readFileSync(new URL('../api/go.mod', import.meta.url), 'utf8');

const parseVersion = (version) => version.split('.').map(Number);
const atLeast = (actual, minimum) => {
  const a = parseVersion(actual);
  const b = parseVersion(minimum);
  return a.find((n, i) => n !== b[i]) === undefined
    || a.find((n, i) => n !== b[i]) > b[a.findIndex((n, i) => n !== b[i])];
};

function verifyToolchainPins(docker, ci, module) {
  const image = docker.match(/^FROM\s+--platform=\$BUILDPLATFORM\s+golang:(\d+\.\d+\.\d+)-alpine(\d+\.\d+)\s+AS\s+build\s*$/m);
  assert.ok(image, 'API builder must use a fully patch-pinned Go/Alpine image for BUILDPLATFORM');
  const pinnedCi = [...ci.matchAll(/^\s*go-version:\s*['"]?(\d+\.\d+\.\d+)['"]?\s*$/gm)];
  assert.equal(pinnedCi.length, 1, 'API CI must pin exactly one full Go toolchain version');
  assert.doesNotMatch(ci, /^\s*go-version-file:/m, 'Go module minimum is not a substitute for patched CI toolchain');
  assert.equal(pinnedCi[0][1], image[1], 'Docker and CI must compile with the same Go patch release');
  assert.ok(atLeast(image[1], '1.27.3'), 'security floor: Go 1.27.3 or newer required');
  const minimum = module.match(/^go\s+(\d+\.\d+(?:\.\d+)?)\s*$/m);
  assert.ok(minimum, 'api/go.mod must declare the minimum Go release');
  const minVersion = minimum[1].split('.').length === 2 ? `${minimum[1]}.0` : minimum[1];
  assert.ok(atLeast(image[1], minVersion), 'builder must not be older than module Go requirement');
}

test('Chronicles API Docker image and CI use the same supported, patched Go toolchain', () => {
  verifyToolchainPins(dockerfile, workflow, goMod);
});

test('security contract rejects CI patch drift, floating tags and unpatched 1.27.x', () => {
  assert.throws(
    () => verifyToolchainPins(dockerfile, workflow.replace("go-version: '1.27.3'", "go-version: '1.27.2'"), goMod),
    /same Go patch release/,
  );
  assert.throws(
    () => verifyToolchainPins(dockerfile.replace('golang:1.27.3-alpine3.23', 'golang:1.27-alpine'), workflow, goMod),
    /fully patch-pinned/,
  );
  assert.throws(
    () => verifyToolchainPins(
      dockerfile.replace('golang:1.27.3-alpine3.23', 'golang:1.27.2-alpine3.23'),
      workflow.replace("go-version: '1.27.3'", "go-version: '1.27.2'"),
      goMod,
    ),
    /security floor/,
  );
});

test('security contract allows deliberate matching future Go point-release upgrades', () => {
  verifyToolchainPins(
    dockerfile.replace('golang:1.27.3-alpine3.23', 'golang:1.27.4-alpine3.23'),
    workflow.replace("go-version: '1.27.3'", "go-version: '1.27.4'"),
    goMod,
  );
});
