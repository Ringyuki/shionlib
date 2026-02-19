import { ValidationError } from 'class-validator'
import { flattenValidationErrors } from './flatten-validation.util'

describe('flattenValidationErrors', () => {
  it('flattens nested validation errors with bracket path', () => {
    const errors: ValidationError[] = [
      {
        property: 'payload',
        children: [
          {
            property: 'email',
            constraints: {
              isEmail: 'email must be an email',
            },
          } as ValidationError,
          {
            property: 'items',
            children: [
              {
                property: '0',
                constraints: {
                  whitelistValidation: 'property should not exist',
                },
              } as ValidationError,
            ],
          } as ValidationError,
        ],
      } as ValidationError,
    ]

    const out = flattenValidationErrors(errors, { delimiter: 'bracket' })

    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      field: 'payload.email',
      messages: ['email must be an email'],
    })
    expect(out[1]).toEqual({
      field: 'payload.items[0]',
      messages: ['validation.common.PROPERTY_SHOULD_NOT_EXIST|{"property":"payload.items[0]"}'],
    })
  })

  it('de-duplicates repeated constraint messages', () => {
    const errors: ValidationError[] = [
      {
        property: 'name',
        constraints: {
          minLength: 'too short',
          custom: 'too short',
        },
      } as ValidationError,
    ]

    const out = flattenValidationErrors(errors)

    expect(out).toEqual([
      {
        field: 'name',
        messages: ['too short'],
      },
    ])
  })
})
