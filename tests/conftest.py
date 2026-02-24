"""
Mocks heavy dependencies so app.py can be imported without a running Streamlit
server, a real display, or installed openpyxl/pandas.
"""
import sys
from unittest.mock import MagicMock


class FakeSessionState:
    """Minimal Streamlit SessionState substitute.

    Supports both attribute-style (st.session_state.foo) and item-style
    (st.session_state['foo']) access, plus .get() with a default, so the
    module-level Streamlit UI code can execute without raising TypeError.
    """
    def __init__(self):
        object.__setattr__(self, '_data', {})

    def __contains__(self, key):
        return key in self._data

    def __getattr__(self, key):
        return self._data.get(key)

    def __setattr__(self, key, value):
        self._data[key] = value

    def __getitem__(self, key):
        return self._data[key]

    def __setitem__(self, key, value):
        self._data[key] = value

    def __delitem__(self, key):
        self._data.pop(key, None)

    def get(self, key, default=None):
        return self._data.get(key, default)

    def items(self):
        return self._data.items()

    def keys(self):
        return self._data.keys()


# Build a proper fake streamlit package so submodule imports like
# `import streamlit.components.v1 as components` succeed.
st_mock = MagicMock()
st_mock.session_state = FakeSessionState()

components_v1 = MagicMock()
components_mock = MagicMock()
components_mock.v1 = components_v1
st_mock.components = components_mock

# Make st.tabs / st.columns return correctly-sized lists of MagicMocks so
# tuple-unpacking assignments in the UI code don't fail.
def _sized_list(arg):
    n = arg if isinstance(arg, int) else len(arg)
    return [MagicMock() for _ in range(n)]

st_mock.tabs = _sized_list
st_mock.columns = _sized_list

sys.modules['streamlit'] = st_mock
sys.modules['streamlit.components'] = components_mock
sys.modules['streamlit.components.v1'] = components_v1

# Stub openpyxl and pandas — individual tests that need real behaviour
# will supply their own fixtures.
sys.modules.setdefault('openpyxl', MagicMock())
sys.modules.setdefault('pandas', MagicMock())
sys.modules.setdefault('anthropic', MagicMock())
sys.modules.setdefault('PIL', MagicMock())
sys.modules.setdefault('PIL.Image', MagicMock())
