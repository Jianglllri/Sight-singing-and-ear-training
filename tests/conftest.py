"""pytest 公共夹具：在导入 app 之前指定临时数据库路径。"""
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# 必须在 import app 之前设置，避免污染真实数据库
_tmp_db = tempfile.NamedTemporaryFile(prefix='jianpu_test_', suffix='.sqlite', delete=False)
_tmp_db.close()
os.environ.setdefault('JIANPU_DB_PATH', _tmp_db.name)

import pytest  # noqa: E402

import app as appmod  # noqa: E402


@pytest.fixture()
def client():
    appmod.app.config['TESTING'] = True
    with appmod.app.test_client() as test_client:
        yield test_client


@pytest.fixture()
def app_module():
    return appmod
