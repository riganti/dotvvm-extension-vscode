import fs from 'fs'
import { SerializedConfigSeeker } from '../../src/lib/serializedConfigSeeker'

const testingConfig = JSON.parse(fs.readFileSync("test/lib/dotvvm_serialized_config.json.tmp", 'utf8'))

export const configSeeker = new SerializedConfigSeeker([])
configSeeker.configs.x = testingConfig
