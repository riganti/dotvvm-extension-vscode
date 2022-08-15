import assert from 'assert'
import * as res from '../../src/lib/dotvvmControlResolver'
import { configSeeker } from './testingDotvvmConfig'

describe("dotvvmControlResolver.ts", () => {
	const c = configSeeker

	describe("#listControls", () => {
		it("should return all controls", () => {
			const controls = res.listControls(c, "DotVVM.Framework.Controls.DotvvmControl")
			const dotObjects = res.listControls(c, "DotVVM.Framework.Controls.DotvvmBindableObject")

			assert.deepStrictEqual(
				controls.find(c => c.tag == "dot:Repeater")?.control.type?.fullName,
				"DotVVM.Framework.Controls.Repeater"
			)
			assert.deepStrictEqual(
				dotObjects.find(c => c.tag == "dot:Repeater")?.control.type?.fullName,
				"DotVVM.Framework.Controls.Repeater"
			)

			// console.log(dotObjects.map(c => c.tag))

			// shoudn't be in controls
			assert.strictEqual(undefined, controls.find(c => c.tag == "dot:ConfirmPostBackHandler"))
			assert.strictEqual(
				"DotVVM.Framework.Controls.ConfirmPostBackHandler",
				dotObjects.find(c => c.tag == "dot:ConfirmPostBackHandler")?.control.type?.fullName
			)
		})

		it("should list postback handlers", () => {
			const handlers = res.listControls(c, "DotVVM.Framework.Controls.PostBackHandler")

			assert.deepStrictEqual(
				handlers.find(c => c.tag == "dot:Repeater"),
				undefined
			)
			assert.strictEqual(
				"DotVVM.Framework.Controls.ConfirmPostBackHandler",
				handlers.find(c => c.tag == "dot:ConfirmPostBackHandler")?.control.type?.fullName
			)
		})

	})
})
