## Contents

* [Installation](#installation)
* [Introduction](#introduction)
* [Concepts](#concepts)
    * [Contract mapping](#contract-mapping)
    * [Contract artifact](#contract-artifact)
    * [Artifact reference](#artifact-reference)
* [Library](#library) 
    * [Configuration](#configuration) 
        * [Consumer name](#consumer-name) 
        * [Wiremock artifact](#wiremock-artifact) 
        * [Artifact repositories](#artifact-repositories) 
    * [Usage](#usage) 
* [Error messages](#error-messages)
* [Supported libraries](#supported-libraries)

## Installation

```sh
npm install node-cdc
```

## Introduction

Consumer Driven Contracts are a pattern that drives the development of the producer from its consumer's point of view. It is TDD for services.
This library provides an implementation for JavaScript consumers to verify if they satisfy externally defined HTTP contracts.

## Concepts

#### Contract mapping

A contract mapping is a json file containing a WireMock stub definition. More information on this format can be found in the [WireMock documentation](http://wiremock.org/docs/stubbing/).

#### Contract artifact

A contract artifact is an archive file (zip, jar, ...) that contains WireMock json mappings generated from contracts. If the artifact contains the contract mappings for multiple consumers then it needs to seperate these in different directories using the consumer name as the identifier. This identifier can then be used as the value of the `consumerName` option when creating a StubRunner.

#### Artifact reference

Artifacts can be referenced by using the following string format `${groupId}:${artifactId}:${version}(:${classifier})`.

## Library

The StubRunner class is the entrypoint of the library. It is used to start a WireMock standalone server for each defined contract artifact.  

### Configuration

The StubRunner can be configured using the `StubRunnerOptions` interface.

```js
export interface StubRunnerOptions {
    consumerName?: string,
    wireMockArtifact?: string,
    artifactRepositories: string[]
}
```

#### Consumer name

Specifies the name of the consumer. This option will ensure that only the contracts mappings for this specific consumer will be extracted from the contract artifact. If this option is not defined all contract mappings from the contract artifact will be extracted.

#### Wiremock artifact

Specifies the WireMock standalone artifact reference. It will default to `com.github.tomakehurst:wiremock-standalone:2.21.0` if this option is not defined.

#### Artifact repositories

Specifies the repository URIs to be used when downloading the WireMock standalone and contract artifacts. You can use `~/.m2/repository/` for the local maven repository and for example `http://central.maven.org/maven2/` for Maven Central. The order of the repositories is the order they will be queried, so it is recommended to put the local maven repository as the first entry.

### Usage

The StubRunner can be started using the `ContractPortMappings` interface. The interface uses the port as its key and the contract artifact reference as its value. 

```js
export interface ContractPortMappings {
    [key: number]: string
}
```

__Example:__

```js
import { StubRunner } from 'node-cdc';
import { createPerson } from './person-client';

const STUBRUNNER_OPTIONS = {
  consumerName: 'frontend',
  artifactRepositories: [
      // local repository (in this example for the contract artifact)
      '~/.m2/repository/', 
      // remote repository (in this example for the WireMock artifact)
      'http://central.maven.org/maven2/'
  ]
};

const CONTRACT_MAPPINGS = {
  8080: 'com.company:contracts:local:stubs'
};

describe('Person API', () => {

  let stubrunner = new StubRunner(STUBRUNNER_OPTIONS);

  beforeAll((done) => {
    stubrunner.start(CONTRACT_MAPPINGS)
        .then(() => done());
  });

  it('should be able to create a person by name', (done) => {
    createPerson('David')
      .then((response) => {
        expect(response.status).toBe(201);
        done();
      });
  });

  afterAll(() => {
    stubrunner.stop();
  });
});
```

## Error messages

#### Error: Request was not matched

This error specifies that the HTTP client on the consuming side made a request that did not match the contract. The StubRunner will log the 'Closest stub' that was found and the 'Request' that was made. Use this information to find which part of the request did not match the contract.

#### Error: Invalid or corrupt jarfile .\wire-mock.jar

This is currently an unresolved error. You can try to put the WireMock artifact in a local registry and see if this helps.

#### Error: '`${artifactReference}`' could not be found in any of the declared repositories

If you encounter this error make sure that the artifact is present in one of the declared repositories. You can specify the repositories by using the `artifactRepositories` when creating a StubRunner. Make sure that you use `~/.m2/repository/` for your local maven registry and not `~/.m2/`.

## Supported libraries

In theory all contract artifacts containing WireMock json mappings are supported. Spring Cloud Contract is a perfect example that uses this format and will be used as demo material in further examples.
