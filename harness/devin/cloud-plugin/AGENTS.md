# AI-DLC on Devin Cloud

When a repository in this session has `.devin/rules/aidlc-method.md`, it uses
the AI-DLC method: read that file and `.devin/rules/aidlc-onboarding.md` in
that repository before any AI-DLC work, and honour them. Start or resume an
AI-DLC workflow with the `aidlc` skill. In AI-DLC work, ask the person every
question as numbered options in your message and wait for their reply; never
use `ask_user_question`, because an answer given there is not recorded as the
person's message and an approval gate would refuse it.

Repositories without `.devin/rules/aidlc-method.md` do not use AI-DLC; ignore
this note there.
